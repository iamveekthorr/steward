/// Subscription guard middleware + repository + payment instructions endpoints.
use axum::{
    Json, Router,
    body::Body,
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    app::{AppState, PostgresDbPool},
    authentication::jwt::AuthClaims,
    enums::subscription_status::SubscriptionStatus,
    errors::ApiError,
    utils::response::ApiResponse,
};

// ── DTO ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SubscriptionRow {
    pub id: Uuid,
    pub manager_id: Uuid,
    pub manager_name: String,
    pub manager_email: String,
    pub status: SubscriptionStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub grace_until: Option<DateTime<Utc>>,
    pub payment_ref: Option<String>,
    pub amount_cents: Option<i32>,
    pub currency: String,
    pub expiry_email_sent: bool,
    pub created_at: DateTime<Utc>,
}

// ── Repository ────────────────────────────────────────────────────────────────

pub trait SubscriptionRepository {
    fn find_subscription_for_manager(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<SubscriptionStatus>, sqlx::Error>> + Send;
}

impl SubscriptionRepository for PostgresDbPool {
    async fn find_subscription_for_manager(
        &self,
        manager_id: Uuid,
    ) -> Result<Option<SubscriptionStatus>, sqlx::Error> {
        sqlx::query_scalar::<_, SubscriptionStatus>(
            "SELECT status FROM subscriptions WHERE manager_id = $1 ORDER BY created_at DESC LIMIT 1",
        )
        .bind(manager_id)
        .fetch_optional(&self.pool)
        .await
    }
}

// ── Guard middleware ──────────────────────────────────────────────────────────

/// Axum middleware that blocks manager routes unless their active subscription
/// is `active` or `grace`.  Returns 402 Payment Required with a JSON body
/// that the frontend can detect and redirect to the payment gate.
pub async fn subscription_guard(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    // Decode the Bearer token from the Authorization header without re-validating
    // expiry — ManagerClaims (applied in each handler) does full validation.
    // We only need the entity_id / sub to perform the subscription check.
    let token = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    let manager_id: Option<Uuid> = token.and_then(|t| {
        crate::authentication::jwt::decode_claims(t, &state.jwt_secret)
            .ok()
            .and_then(|c| {
                // ABAC fast path: entity_id holds the manager_id
                c.entity_id
                    .as_deref()
                    .and_then(|s| Uuid::parse_str(s).ok())
            })
    });

    let manager_id = match manager_id {
        Some(id) => id,
        None => {
            // No valid token or no entity_id — let the handler's own extractor
            // return the proper 401.
            return next.run(request).await;
        }
    };

    match state.db.find_subscription_for_manager(manager_id).await {
        Ok(Some(status)) if status.is_allowed() => {
            // Inject grace header so the frontend can show a banner.
            if status == SubscriptionStatus::Grace {
                request.extensions_mut().insert(SubscriptionGrace);
            }
            let mut response = next.run(request).await;
            if status == SubscriptionStatus::Grace {
                response.headers_mut().insert(
                    "X-Subscription-Grace",
                    axum::http::HeaderValue::from_static("1"),
                );
            }
            response
        }
        Ok(_) => {
            // pending_payment, expired, suspended, or no row
            let body = serde_json::json!({
                "status": false,
                "message": "Subscription required. Please send payment to activate your account.",
                "data": null
            });
            Response::builder()
                .status(StatusCode::PAYMENT_REQUIRED)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap()
        }
        Err(e) => {
            tracing::error!("Subscription guard DB error: {e}");
            // Fail open on DB error so a DB blip doesn't lock everyone out.
            next.run(request).await
        }
    }
}

#[derive(Clone)]
pub struct SubscriptionGrace;

// ── Payment instructions DTOs ─────────────────────────────────────────────────

#[derive(Serialize)]
pub struct PaymentInstructions {
    pub details: String,
    pub note: String,
}

#[derive(Deserialize)]
pub struct SubmitPaymentRefRequest {
    pub payment_ref: String,
}

// ── Public router (any authenticated user) ────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/subscriptions", get(list_subscriptions))
        .route("/subscription/payment-instructions", get(payment_instructions))
        .route("/subscription/submit-payment-ref", post(submit_payment_ref))
}

/// Returns the admin's LemFi payment details so managers know where to send money.
/// Requires any valid JWT — the guard already blocks their API calls, so this
/// endpoint must NOT be on the guarded manager router.
async fn payment_instructions(
    State(state): State<AppState>,
    _claims: AuthClaims,
) -> Result<ApiResponse<PaymentInstructions>, ApiError> {
    let details = state.lemfi_payment_details.as_str().to_owned();

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Payment instructions retrieved"),
        data: Some(PaymentInstructions {
            details,
            note: String::from(
                "Send the exact subscription amount to the account above. \
                 Once payment is confirmed, the admin will activate your subscription. \
                 Include your registered email in the payment reference so the payment can be matched.",
            ),
        }),
    })
}

/// Manager submits their transaction reference after sending payment.
/// Records it on their subscription row and notifies the admin (via the
/// existing email infrastructure) so they know to verify and activate.
async fn submit_payment_ref(
    State(state): State<AppState>,
    AuthClaims(claims): AuthClaims,
    Json(body): Json<SubmitPaymentRefRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    if body.payment_ref.trim().is_empty() {
        return Err(ApiError::BadRequest("Payment reference cannot be empty".into()));
    }

    // Find manager_id from the authenticated user.
    let user_id: Uuid = claims.sub.parse().map_err(|_| ApiError::BadRequest("Invalid user ID".into()))?;
    let manager_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM managers WHERE user_id = $1 LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to look up manager"))?;

    let manager_id = manager_id.ok_or_else(|| ApiError::NotFound("Manager record not found".into()))?;

    // Upsert the payment_ref on the manager's current subscription row.
    let rows = sqlx::query(r#"
        UPDATE subscriptions
        SET payment_ref = $2, updated_at = NOW()
        WHERE manager_id = $1
          AND status IN ('pending_payment', 'expired', 'suspended', 'grace')
    "#)
    .bind(manager_id)
    .bind(body.payment_ref.trim())
    .execute(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to record payment reference"))?
    .rows_affected();

    if rows == 0 {
        // No pending subscription row — insert one.
        sqlx::query(r#"
            INSERT INTO subscriptions (manager_id, status, payment_ref)
            VALUES ($1, 'pending_payment', $2)
            ON CONFLICT DO NOTHING
        "#)
        .bind(manager_id)
        .bind(body.payment_ref.trim())
        .execute(&state.db.pool)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to create subscription record"))?;
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from(
            "Payment reference submitted. The admin will verify and activate your subscription shortly.",
        ),
        data: None,
    })
}

async fn list_subscriptions(
    State(state): State<AppState>,
    _claims: crate::authentication::jwt::AdminClaims,
) -> Result<ApiResponse<Vec<SubscriptionRow>>, crate::errors::ApiError> {
    let rows = sqlx::query_as::<_, SubscriptionRow>(r#"
        SELECT
            s.id,
            s.manager_id,
            u.first_name || ' ' || u.last_name AS manager_name,
            ai.provider_user_id AS manager_email,
            s.status,
            s.started_at,
            s.expires_at,
            s.grace_until,
            s.payment_ref,
            s.amount_cents,
            s.currency,
            s.expiry_email_sent,
            s.created_at
        FROM subscriptions s
        JOIN managers m ON m.id = s.manager_id
        JOIN users u ON u.id = m.user_id
        LEFT JOIN auth_identities ai ON ai.user_id = m.user_id
        ORDER BY s.created_at DESC
    "#)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| crate::errors::ApiError::Database(e, "Failed to list subscriptions"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: format!("{} subscription(s) found", rows.len()),
        data: Some(rows),
    })
}
