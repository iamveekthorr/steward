use crate::models::users_model::UsersRepository;
use axum::{
    Router,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use uuid::Uuid;

use crate::{app::AppState, models::users_model::UsersDto, utils::response::ApiResponse};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/users", get(get_users))
        .route("/users/{id}", get(get_user_by_id))
}

async fn get_users(State(state): State<AppState>) -> ApiResponse<Vec<UsersDto>> {
    match state.db.find_all().await {
        Ok(users) if !users.is_empty() => ApiResponse {
            http_status: StatusCode::OK,
            status: false,
            message: String::from("Users retrieved successfully"),
            data: Some(users),
        },

        Ok(_) => ApiResponse {
            http_status: StatusCode::NO_CONTENT,
            status: true,
            message: String::from("No users found!"),
            data: None,
        },

        Err(e) => {
            tracing::error!("Database error: {:?}", e);
            ApiResponse {
                http_status: StatusCode::INTERNAL_SERVER_ERROR,
                status: false,
                message: format!("Database error: {}", e),
                data: None,
            }
        }
    }
}

async fn get_user_by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResponse<UsersDto> {
    match state.db.find_by_id(id).await {
        Ok(Some(user)) => ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("Users retrieved successfully"),
            data: Some(user),
        },
        Ok(None) => ApiResponse {
            http_status: StatusCode::NOT_FOUND,
            status: false,
            message: format!("No user found with id: {:#}", id),
            data: None,
        },
        Err(err) => {
            tracing::error!("Database error: {:?}", err);
            ApiResponse {
                http_status: StatusCode::INTERNAL_SERVER_ERROR,
                status: false,
                message: String::from("Not implemented"),
                data: None,
            }
        }
    }
}
