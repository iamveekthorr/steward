use crate::models::users_model::UsersRepository;
use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use serde::{Deserialize, Serialize};

use crate::{
    app::AppState,
    authentication::jwt::AuthClaims,
    errors::{ApiError, parse_user_id},
    models::users_model::UsersDto,
    utils::response::ApiResponse,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserSettingsDto {
    pub theme: String,
    pub enable_email_notifications: bool,
    pub reminder_days_before: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub theme: Option<String>,
    pub enable_email_notifications: Option<bool>,
    pub reminder_days_before: Option<i32>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/users/me", get(get_me))
        .route("/users/settings", get(get_settings).patch(update_settings))
}

async fn get_me(
    State(state): State<AppState>,
    AuthClaims(claims): AuthClaims,
) -> Result<ApiResponse<UsersDto>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;

    let user = state
        .db
        .find_by_id(user_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve user"))?
        .ok_or_else(|| ApiError::NotFound("User not found".to_string()))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("User retrieved successfully"),
        data: Some(user),
    })
}

async fn get_settings(
    State(state): State<AppState>,
    AuthClaims(claims): AuthClaims,
) -> Result<ApiResponse<UserSettingsDto>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;

    let settings = sqlx::query_as::<_, UserSettingsDto>(
        "SELECT theme, enable_email_notifications, reminder_days_before
         FROM user_settings
         WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to retrieve settings"))?
    .unwrap_or(UserSettingsDto {
        theme: String::from("system"),
        enable_email_notifications: true,
        reminder_days_before: 3,
    });

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Settings retrieved"),
        data: Some(settings),
    })
}

async fn update_settings(
    State(state): State<AppState>,
    AuthClaims(claims): AuthClaims,
    Json(body): Json<UpdateSettingsRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;

    sqlx::query(
        "INSERT INTO user_settings (user_id, theme, enable_email_notifications, reminder_days_before)
         VALUES ($1, COALESCE($2, 'system'), COALESCE($3, true), COALESCE($4, 3))
         ON CONFLICT (user_id) DO UPDATE SET
             theme                      = COALESCE($2, user_settings.theme),
             enable_email_notifications = COALESCE($3, user_settings.enable_email_notifications),
             reminder_days_before       = COALESCE($4, user_settings.reminder_days_before),
             updated_at                 = NOW()",
    )
    .bind(user_id)
    .bind(body.theme)
    .bind(body.enable_email_notifications)
    .bind(body.reminder_days_before)
    .execute(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to update settings"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Settings updated"),
        data: None,
    })
}
