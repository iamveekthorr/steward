use axum::{
    Json,
    http::{HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::json;
use uuid::Uuid;

use crate::storage::store::StorageError;

/// Parse a JWT `sub` claim into a `Uuid`.
pub fn parse_user_id(sub: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(sub).map_err(|_| ApiError::BadRequest("Invalid token subject".to_string()))
}

/// Typed application error.  Every variant carries a user-visible message (or
/// derives a generic one) and is logged at the appropriate level before the
/// HTTP response is sent.
#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    Conflict(String),
    /// Rate limit exceeded.  `retry_after_secs` is the number of seconds the
    /// client should wait before retrying — emitted as a `Retry-After` header.
    TooManyRequests(String, Option<u64>),
    /// A sqlx error with a sanitised context message shown to the client.
    Database(sqlx::Error, &'static str),
    /// A storage error with a sanitised context message shown to the client.
    Storage(StorageError, &'static str),
    /// Any other 500 error where the message is already safe for the client.
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        // Extract retry_after before moving self into the match below.
        let retry_after_secs = if let ApiError::TooManyRequests(_, secs) = &self {
            *secs
        } else {
            None
        };

        let (status, message) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            ApiError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            ApiError::TooManyRequests(msg, _) => (StatusCode::TOO_MANY_REQUESTS, msg),
            ApiError::Database(e, ctx) => {
                tracing::error!("{ctx}: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, ctx.to_string())
            }
            ApiError::Storage(e, ctx) => {
                tracing::error!("{ctx}: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, ctx.to_string())
            }
            ApiError::Internal(msg) => {
                tracing::error!("Internal error: {msg}");
                (StatusCode::INTERNAL_SERVER_ERROR, msg)
            }
        };

        let mut res =
            (status, Json(json!({ "status": false, "message": message }))).into_response();

        if let Some(secs) = retry_after_secs.and_then(|s| HeaderValue::from_str(&s.to_string()).ok()) {
            res.headers_mut().insert("Retry-After", secs);
        }

        res
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        ApiError::Database(e, "An internal error occurred")
    }
}

impl From<StorageError> for ApiError {
    fn from(e: StorageError) -> Self {
        ApiError::Storage(e, "A storage error occurred")
    }
}
