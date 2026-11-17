use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
};
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

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(list_all_users))
        .route("/admin/users/{id}", get(get_user_by_id))
        .route("/admin/managers", get(list_all_managers))
        .route("/admin/managers/create-account", post(create_manager_account))
        .route("/admin/managers/{id}/verify", patch(verify_manager))
        .route("/admin/managers/{id}/suspend", patch(suspend_manager))
        .route("/admin/managers/{id}/revoke", patch(revoke_manager))
        .route("/admin/managers/{id}/approve-links", patch(approve_links_quota))
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
