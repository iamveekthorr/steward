use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

use crate::{
    app::AppState,
    authentication::jwt::AdminClaims,
    enums::manager_status::ManagerStatus,
    errors::{ApiError, parse_user_id},
    models::users_model::{UsersDto, UsersRepository},
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

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(list_all_users))
        .route("/admin/users/{id}", get(get_user_by_id))
        .route("/admin/managers", get(list_all_managers))
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
