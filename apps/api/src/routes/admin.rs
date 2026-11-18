use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
};
use chrono::Duration;
use chrono::{DateTime, Utc};
use rand::{Rng, distributions::Alphanumeric};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;
use validator::Validate;

use crate::{
    app::AppState,
    authentication::{
        jwt::AdminClaims,
        password::hash_password,
    },
    enums::manager_status::ManagerStatus,
    errors::{ApiError, parse_user_id},
    models::{
        auth::AuthRepository,
        users_model::{UsersDto, UsersRepository},
    },
    utils::response::ApiResponse,
};

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct AdminManagerDto {
    pub id: Uuid,
    pub user_id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub status: ManagerStatus,
    pub links_quota_approved: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct LinkQuotaStatus {
    pub link_count: i64,
    pub quota_approved: bool,
    pub can_add_links: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetManagerStatusRequest {}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateManagerAccountRequest {
    #[validate(length(min = 1, max = 100, message = "First name must be 1–100 characters"))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100, message = "Last name must be 1–100 characters"))]
    pub last_name: String,
    #[validate(email(message = "Invalid email address"), length(max = 255))]
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct CreateManagerAccountResponse {
    pub user_id: Uuid,
    pub manager_id: Uuid,
    pub email: String,
    pub temporary_password: String,
}

// ── Subscription DTOs ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ActivateSubscriptionRequest {
    /// Manager's payment reference number (e.g. LemFi transaction ID).
    pub payment_ref: Option<String>,
    /// Number of months to grant. Defaults to 1.
    #[serde(default = "default_months")]
    pub months: u32,
}

fn default_months() -> u32 { 1 }

// ── New DTOs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct AdminStats {
    pub total_users: i64,
    pub total_managers: i64,
    pub pending_managers: i64,
    pub verified_managers: i64,
    pub total_links: i64,
    pub active_links: i64,
    pub total_payouts: i64,
    pub total_payout_amount: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AdminLinkDto {
    pub id: Uuid,
    pub manager_name: String,
    pub manager_id: Uuid,
    pub worker_name: String,
    pub worker_id: Uuid,
    pub job_type: String,
    pub status: String,
    pub work_country: String,
    pub created_at: DateTime<Utc>,
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/stats", get(get_stats))
        .route("/admin/users", get(list_all_users))
        .route("/admin/users/{id}", get(get_user_by_id))
        .route("/admin/managers", get(list_all_managers))
        .route("/admin/managers/create-account", post(create_manager_account))
        .route("/admin/managers/{id}/verify", patch(verify_manager))
        .route("/admin/managers/{id}/suspend", patch(suspend_manager))
        .route("/admin/managers/{id}/revoke", patch(revoke_manager))
        .route("/admin/managers/{id}/approve-links", patch(approve_links_quota))
        .route("/admin/links", get(list_all_links))
        .route("/admin/managers/{id}/activate-subscription", post(activate_subscription))
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn list_all_users(
    State(state): State<AppState>,
    _claims: AdminClaims,
) -> Result<ApiResponse<Vec<UsersDto>>, ApiError> {
    let users = state
        .db
        .find_all()
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve users"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: format!("{} user(s) found", users.len()),
        data: Some(users),
    })
}

async fn get_user_by_id(
    State(state): State<AppState>,
    _claims: AdminClaims,
    Path(id): Path<Uuid>,
) -> Result<ApiResponse<UsersDto>, ApiError> {
    let user = state
        .db
        .find_by_id(id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve user"))?
        .ok_or_else(|| ApiError::NotFound(format!("User {} not found", id)))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("User retrieved"),
        data: Some(user),
    })
}

async fn list_all_managers(
    State(state): State<AppState>,
    _claims: AdminClaims,
) -> Result<ApiResponse<Vec<AdminManagerDto>>, ApiError> {
    let managers = sqlx::query_as::<_, AdminManagerDto>(
        "SELECT m.id, m.user_id, ai.provider_user_id AS email,
                u.first_name, u.last_name, m.status,
                m.links_quota_approved, m.verified_at, m.created_at
         FROM managers m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN auth_identities ai ON ai.user_id = m.user_id
         ORDER BY m.created_at DESC",
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to list managers"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: format!("{} manager(s) found", managers.len()),
        data: Some(managers),
    })
}

async fn verify_manager(
    State(state): State<AppState>,
    AdminClaims(claims): AdminClaims,
    Path(id): Path<Uuid>,
    Json(_body): Json<SetManagerStatusRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let admin_id = parse_user_id(&claims.sub)?;

    let rows = sqlx::query(
        "UPDATE managers
         SET status = 'verified', verified_by = $2, verified_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'pending'",
    )
    .bind(id)
    .bind(admin_id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to verify manager"))?
    .rows_affected();

    if rows == 0 {
        return Err(ApiError::Conflict(
            "Manager not found or is not in pending status".to_string(),
        ));
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Manager verified"),
        data: None,
    })
}

async fn suspend_manager(
    State(state): State<AppState>,
    _claims: AdminClaims,
    Path(id): Path<Uuid>,
    Json(_body): Json<SetManagerStatusRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let rows = sqlx::query(
        "UPDATE managers
         SET status = 'suspended', updated_at = NOW()
         WHERE id = $1 AND status IN ('pending', 'verified')",
    )
    .bind(id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to suspend manager"))?
    .rows_affected();

    if rows == 0 {
        return Err(ApiError::Conflict(
            "Manager not found or is already suspended/revoked".to_string(),
        ));
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Manager suspended"),
        data: None,
    })
}

async fn revoke_manager(
    State(state): State<AppState>,
    _claims: AdminClaims,
    Path(id): Path<Uuid>,
    Json(_body): Json<SetManagerStatusRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let rows = sqlx::query(
        "UPDATE managers
         SET status = 'revoked', updated_at = NOW()
         WHERE id = $1 AND status != 'revoked'",
    )
    .bind(id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to revoke manager"))?
    .rows_affected();

    if rows == 0 {
        return Err(ApiError::Conflict(
            "Manager not found or is already revoked".to_string(),
        ));
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Manager revoked"),
        data: None,
    })
}

async fn create_manager_account(
    State(state): State<AppState>,
    AdminClaims(_claims): AdminClaims,
    Json(body): Json<CreateManagerAccountRequest>,
) -> Result<ApiResponse<CreateManagerAccountResponse>, ApiError> {
    // Validate the request body manually since we're using plain Json, not ValidatedJson.
    use validator::Validate as _;
    body.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {e}")))?;

    let temp_password: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();

    let password_hash = hash_password(&temp_password).map_err(|e| {
        tracing::error!("Password hashing failed: {e}");
        ApiError::Internal("Account creation failed".to_string())
    })?;

    let user = state
        .db
        .create_account_with_default_password(
            &body.first_name,
            &body.last_name,
            &body.email,
            &password_hash,
        )
        .await
        .map_err(|e| ApiError::Database(e, "Account creation failed"))?;

    let manager_id: Uuid = sqlx::query_scalar(
        "INSERT INTO managers (user_id) VALUES ($1) RETURNING id",
    )
    .bind(user.id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Manager record creation failed"))?;

    Ok(ApiResponse {
        http_status: StatusCode::CREATED,
        status: true,
        message: String::from(
            "Manager account created. Share the temporary password with the manager.",
        ),
        data: Some(CreateManagerAccountResponse {
            user_id: user.id,
            manager_id,
            email: body.email,
            temporary_password: temp_password,
        }),
    })
}

async fn get_stats(
    State(state): State<AppState>,
    _claims: AdminClaims,
) -> Result<ApiResponse<AdminStats>, ApiError> {
    let (total_users,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db.pool)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to count users"))?;

    let row: (i64, i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE status='pending'), COUNT(*) FILTER (WHERE status='verified') FROM managers",
    )
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to count managers"))?;
    let (total_managers, pending_managers, verified_managers) = row;

    let link_row: (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE status='active') FROM links",
    )
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to count links"))?;
    let (total_links, active_links) = link_row;

    let payout_row: (i64, Option<i64>) =
        sqlx::query_as("SELECT COUNT(*), SUM(total_amount) FROM payouts")
            .fetch_one(&state.db.pool)
            .await
            .map_err(|e| ApiError::Database(e, "Failed to count payouts"))?;
    let (total_payouts, total_payout_amount) = payout_row;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Stats retrieved"),
        data: Some(AdminStats {
            total_users,
            total_managers,
            pending_managers,
            verified_managers,
            total_links,
            active_links,
            total_payouts,
            total_payout_amount: total_payout_amount.unwrap_or(0),
        }),
    })
}

async fn list_all_links(
    State(state): State<AppState>,
    _claims: AdminClaims,
) -> Result<ApiResponse<Vec<AdminLinkDto>>, ApiError> {
    let links = sqlx::query_as::<_, AdminLinkDto>(r#"
        SELECT
            l.id,
            mu.first_name || ' ' || mu.last_name AS manager_name,
            m.id AS manager_id,
            wu.first_name || ' ' || wu.last_name AS worker_name,
            wu.id AS worker_id,
            l.job_type,
            l.status::text AS status,
            l.work_country,
            l.created_at
        FROM links l
        JOIN managers m ON m.id = l.manager_id
        JOIN users mu ON mu.id = m.user_id
        JOIN users wu ON wu.id = l.user_id
        ORDER BY l.created_at DESC
    "#)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to list links"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: format!("{} link(s) found", links.len()),
        data: Some(links),
    })
}

async fn approve_links_quota(
    State(state): State<AppState>,
    AdminClaims(_claims): AdminClaims,
    Path(manager_id): Path<Uuid>,
) -> Result<ApiResponse<LinkQuotaStatus>, ApiError> {
    let updated = sqlx::query_scalar::<_, bool>(
        "UPDATE managers
         SET links_quota_approved = true, updated_at = NOW()
         WHERE id = $1 AND links_quota_approved = false
         RETURNING true",
    )
    .bind(manager_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to approve link quota"))?
    .unwrap_or(false);

    if !updated {
        return Err(ApiError::Conflict(
            "Manager quota was already approved or manager not found".to_string(),
        ));
    }

    let link_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM links WHERE manager_id = $1 AND status = 'active'",
    )
    .bind(manager_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Approval succeeded but count check failed"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Link quota approved. Manager can now add more links."),
        data: Some(LinkQuotaStatus {
            link_count,
            quota_approved: true,
            can_add_links: true,
        }),
    })
}

async fn activate_subscription(
    State(state): State<AppState>,
    AdminClaims(claims): AdminClaims,
    Path(manager_id): Path<Uuid>,
    Json(body): Json<ActivateSubscriptionRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let admin_user_id = parse_user_id(&claims.sub)?;
    let months = body.months.max(1) as i64;
    let now = Utc::now();
    let expires_at = now + Duration::days(months * 30);

    // Upsert: if a pending_payment/expired subscription exists, activate it;
    // otherwise insert a fresh active subscription.
    let rows = sqlx::query(r#"
        UPDATE subscriptions
        SET status          = 'active',
            started_at      = NOW(),
            expires_at      = $3,
            grace_until     = NULL,
            payment_ref     = COALESCE($4, payment_ref),
            activated_by    = $5,
            activated_at    = NOW(),
            expiry_email_sent = FALSE,
            updated_at      = NOW()
        WHERE manager_id = $1
          AND status IN ('pending_payment', 'expired', 'suspended')
    "#)
    .bind(manager_id)
    .bind(admin_user_id)
    .bind(expires_at)
    .bind(body.payment_ref.as_deref())
    .bind(admin_user_id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to activate subscription"))?
    .rows_affected();

    if rows == 0 {
        // Insert fresh row (manager had no subscription record or was already active)
        sqlx::query(r#"
            INSERT INTO subscriptions
                (manager_id, status, started_at, expires_at, payment_ref, activated_by, activated_at)
            VALUES ($1, 'active', NOW(), $2, $3, $4, NOW())
            ON CONFLICT (manager_id) WHERE status IN ('pending_payment', 'active', 'grace')
            DO UPDATE SET
                status          = 'active',
                started_at      = NOW(),
                expires_at      = EXCLUDED.expires_at,
                grace_until     = NULL,
                payment_ref     = COALESCE(EXCLUDED.payment_ref, subscriptions.payment_ref),
                activated_by    = EXCLUDED.activated_by,
                activated_at    = NOW(),
                expiry_email_sent = FALSE,
                updated_at      = NOW()
        "#)
        .bind(manager_id)
        .bind(expires_at)
        .bind(body.payment_ref.as_deref())
        .bind(admin_user_id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to create subscription"))?;
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: format!(
            "Subscription activated for {} month(s). Expires {}.",
            months,
            expires_at.format("%Y-%m-%d")
        ),
        data: None,
    })
}
