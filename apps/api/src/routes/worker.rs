use axum::{Router, Json, extract::State, http::StatusCode, routing::{get, patch}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    app::{AppState, PostgresDbPool},
    authentication::jwt::WorkerClaims,
    enums::payout_status::PayoutStatus,
    errors::{ApiError, parse_user_id},
    models::payouts::Payout,
    utils::response::ApiResponse,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/worker/payouts", get(list_payouts))
        .route("/worker/next-payment", get(next_payment))
        .route("/worker/details", get(get_details))
        .route("/worker/bank", patch(update_bank))
        .route("/worker/assets", get(list_assets))
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct WorkerDetails {
    pub link_id: Uuid,
    pub job_type: String,
    pub start_date: chrono::DateTime<chrono::Utc>,
    pub home_country: String,
    pub home_city: Option<String>,
    pub work_country: String,
    pub work_city: Option<String>,
    pub manager_name: String,
    pub pay_schedule: Option<String>,
    pub base_amount: Option<i64>,
    pub currency: Option<String>,
    pub payment_method: Option<String>,
    pub bank_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub preferred_currency: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateBankRequest {
    pub payment_method: String,
    pub bank_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub preferred_currency: String,
}

#[derive(Serialize)]
pub struct AssignedAsset {
    pub id: Uuid,
    pub asset_type: String,
    pub name: String,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub status: String,
}

#[derive(Serialize)]
pub struct WorkerAssets {
    pub devices: Vec<AssignedAsset>,
    pub routers: Vec<AssignedAsset>,
}

#[derive(Serialize)]
pub struct PayoutSummary {
    pub id: Uuid,
    pub period_label: String,
    pub base_amount: i64,
    pub overtime_amount: Option<i64>,
    pub bonus_amount: Option<i64>,
    pub total_amount: i64,
    pub currency: String,
    pub status: PayoutStatus,
    pub paid_at: Option<chrono::DateTime<chrono::Utc>>,
    pub proof_of_payment: Option<String>,
}

#[derive(Serialize)]
pub struct NextPayment {
    pub next_due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub base_amount: Option<i64>,
    pub currency: Option<String>,
    pub pay_schedule: Option<String>,
}

// ── Repository trait ──────────────────────────────────────────────────────────

pub trait WorkerRepository {
    fn find_link_id_for_user(
        &self,
        user_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, sqlx::Error>> + Send;

    fn find_payouts_for_link(
        &self,
        link_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Vec<Payout>, sqlx::Error>> + Send;

    fn find_next_payment_for_link(
        &self,
        link_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<NextPayment>, sqlx::Error>> + Send;

    fn find_worker_details(
        &self,
        link_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<WorkerDetails>, sqlx::Error>> + Send;

    fn upsert_bank_details(
        &self,
        link_id: Uuid,
        req: &UpdateBankRequest,
    ) -> impl std::future::Future<Output = Result<(), sqlx::Error>> + Send;

    fn find_assigned_assets(
        &self,
        link_id: Uuid,
    ) -> impl std::future::Future<Output = Result<WorkerAssets, sqlx::Error>> + Send;
}

impl WorkerRepository for PostgresDbPool {
    async fn find_link_id_for_user(&self, user_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
        // Accept pending and active links so worker can see their details before activation
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM links WHERE user_id = $1 AND status IN ('pending', 'active') LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
    }

    async fn find_payouts_for_link(&self, link_id: Uuid) -> Result<Vec<Payout>, sqlx::Error> {
        sqlx::query_as::<_, Payout>(
            "SELECT * FROM payouts WHERE link_id = $1 ORDER BY period_start DESC",
        )
        .bind(link_id)
        .fetch_all(&self.pool)
        .await
    }

    async fn find_worker_details(&self, link_id: Uuid) -> Result<Option<WorkerDetails>, sqlx::Error> {
        let row = sqlx::query_as::<_, (
            Uuid,
            String,
            chrono::DateTime<chrono::Utc>,
            String,
            Option<String>,
            String,
            Option<String>,
            String,
            Option<String>,
            Option<i64>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        )>(r#"
            SELECT
                l.id,
                l.job_type,
                l.start_date,
                l.home_country,
                l.home_city,
                l.work_country,
                l.work_city,
                u.first_name || ' ' || u.last_name AS manager_name,
                pc.pay_schedule::text,
                pc.base_amount,
                pc.currency,
                lpd.payment_method::text,
                lpd.bank_name,
                lpd.bank_account_number,
                lpd.preferred_currency::text
            FROM links l
            JOIN managers m ON m.id = l.manager_id
            JOIN users u ON u.id = m.user_id
            LEFT JOIN payment_configurations pc
                ON pc.link_id = l.id AND pc.valid_until IS NULL
            LEFT JOIN link_payment_details lpd
                ON lpd.link_id = l.id
            WHERE l.id = $1
        "#)
        .bind(link_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|(id, job_type, start_date, home_country, home_city, work_country, work_city, manager_name, pay_schedule, base_amount, currency, payment_method, bank_name, bank_account_number, preferred_currency)| {
            WorkerDetails {
                link_id: id,
                job_type,
                start_date,
                home_country,
                home_city,
                work_country,
                work_city,
                manager_name,
                pay_schedule,
                base_amount,
                currency,
                payment_method,
                bank_name,
                bank_account_number,
                preferred_currency,
            }
        }))
    }

    async fn upsert_bank_details(
        &self,
        link_id: Uuid,
        req: &UpdateBankRequest,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(r#"
            INSERT INTO link_payment_details (link_id, payment_method, bank_name, bank_account_number, preferred_currency, updated_at)
            VALUES ($1, $2::payment_method, $3, $4, $5::preferred_currency, NOW())
            ON CONFLICT (link_id) DO UPDATE
              SET payment_method      = EXCLUDED.payment_method,
                  bank_name           = EXCLUDED.bank_name,
                  bank_account_number = EXCLUDED.bank_account_number,
                  preferred_currency  = EXCLUDED.preferred_currency,
                  updated_at          = NOW()
        "#)
        .bind(link_id)
        .bind(&req.payment_method)
        .bind(&req.bank_name)
        .bind(&req.bank_account_number)
        .bind(&req.preferred_currency)
        .execute(&self.pool)
        .await
        .map(|_| ())
    }

    async fn find_assigned_assets(&self, link_id: Uuid) -> Result<WorkerAssets, sqlx::Error> {
        let devices = sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<String>, String)>(
            r#"SELECT id, device_type::text, name, model, serial_number, status::text
               FROM devices WHERE current_link_id = $1"#,
        )
        .bind(link_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(id, asset_type, name, model, serial_number, status)| AssignedAsset {
            id,
            asset_type,
            name,
            model,
            serial_number,
            status,
        })
        .collect();

        let routers = sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<String>, String)>(
            r#"SELECT id, router_type::text, name, routes_to, ip_addr::text, status::text
               FROM router_gateways WHERE current_link_id = $1"#,
        )
        .bind(link_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(id, asset_type, name, routes_to, ip_addr, status)| AssignedAsset {
            id,
            asset_type,
            name,
            model: routes_to.into(),
            serial_number: ip_addr,
            status,
        })
        .collect();

        Ok(WorkerAssets { devices, routers })
    }

    async fn find_next_payment_for_link(
        &self,
        link_id: Uuid,
    ) -> Result<Option<NextPayment>, sqlx::Error> {
        let row = sqlx::query_as::<
            _,
            (
                Option<chrono::DateTime<chrono::Utc>>,
                Option<i64>,
                Option<String>,
                Option<String>,
            ),
        >(
            r#"SELECT pc.next_due_date, pc.base_amount, pc.currency, pc.pay_schedule::text
               FROM payment_configurations pc
               WHERE pc.link_id = $1
               ORDER BY pc.created_at DESC
               LIMIT 1"#,
        )
        .bind(link_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|(next_due_date, base_amount, currency, pay_schedule)| NextPayment {
            next_due_date,
            base_amount,
            currency,
            pay_schedule,
        }))
    }
}

// ── Helper ────────────────────────────────────────────────────────────────────

/// Resolves the active link for the given user.  Returns `ApiError::NotFound`
/// when the user has no active link, so callers can propagate with `?`.
async fn resolve_link_id(state: &AppState, user_id: Uuid) -> Result<Uuid, ApiError> {
    match state.db.find_link_id_for_user(user_id).await {
        Ok(Some(id)) => Ok(id),
        Ok(None) => Err(ApiError::NotFound(
            "No active link found for this user".to_string(),
        )),
        Err(e) => Err(ApiError::Database(e, "Failed to resolve worker link")),
    }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn list_payouts(
    State(state): State<AppState>,
    WorkerClaims(claims): WorkerClaims,
) -> Result<ApiResponse<Vec<PayoutSummary>>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let link_id = resolve_link_id(&state, user_id).await?;

    let payouts = state
        .db
        .find_payouts_for_link(link_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve payouts"))?;

    let summaries: Vec<PayoutSummary> = payouts
        .into_iter()
        .map(|p| {
            let label = p.period_start.format("%B %Y").to_string();
            PayoutSummary {
                id: p.id,
                period_label: label,
                base_amount: p.base_amount,
                overtime_amount: p.overtime_amount,
                bonus_amount: p.bonus_amount,
                total_amount: p.total_amount,
                currency: p.currency,
                status: p.status,
                paid_at: Some(p.paid_at),
                proof_of_payment: p.proof_of_payment,
            }
        })
        .collect();

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Payouts retrieved successfully"),
        data: Some(summaries),
    })
}

async fn next_payment(
    State(state): State<AppState>,
    WorkerClaims(claims): WorkerClaims,
) -> Result<ApiResponse<NextPayment>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let link_id = resolve_link_id(&state, user_id).await?;

    let payment = state
        .db
        .find_next_payment_for_link(link_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve next payment"))?
        .ok_or_else(|| ApiError::NotFound("No payment configuration found".to_string()))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Next payment retrieved"),
        data: Some(payment),
    })
}

async fn get_details(
    State(state): State<AppState>,
    WorkerClaims(claims): WorkerClaims,
) -> Result<ApiResponse<WorkerDetails>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let link_id = resolve_link_id(&state, user_id).await?;

    let details = state
        .db
        .find_worker_details(link_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve worker details"))?
        .ok_or_else(|| ApiError::NotFound("Link details not found".to_string()))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Worker details retrieved"),
        data: Some(details),
    })
}

async fn update_bank(
    State(state): State<AppState>,
    WorkerClaims(claims): WorkerClaims,
    Json(body): Json<UpdateBankRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let link_id = resolve_link_id(&state, user_id).await?;

    state
        .db
        .upsert_bank_details(link_id, &body)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to update bank details"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Bank details updated"),
        data: None,
    })
}

async fn list_assets(
    State(state): State<AppState>,
    WorkerClaims(claims): WorkerClaims,
) -> Result<ApiResponse<WorkerAssets>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let link_id = resolve_link_id(&state, user_id).await?;

    let assets = state
        .db
        .find_assigned_assets(link_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve assets"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Assets retrieved"),
        data: Some(assets),
    })
}
