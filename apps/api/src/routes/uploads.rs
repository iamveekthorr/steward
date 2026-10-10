//! Generic file-upload endpoints.
//!
//! # Presigned upload flow
//! 1. Client calls `POST /uploads/presign` with the MIME type of the file.
//! 2. The API generates a time-limited presigned PUT URL (5 minutes) and
//!    returns a stable object `key`.
//! 3. The browser PUTs the file **directly** to the presigned URL — no binary
//!    data travels through this server.
//! 4. The client passes the returned `key` as `proof_key` when recording a
//!    payout (`POST /manager/payouts`).

use axum::{Json, Router, extract::State, http::StatusCode, routing::post};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    app::AppState, authentication::jwt::AuthClaims, errors::ApiError, utils::response::ApiResponse,
};

/// Presigned PUT URLs expire after this many seconds (5 minutes).
const PRESIGN_TTL_SECS: u64 = 300;

pub fn router() -> Router<AppState> {
    Router::new().route("/uploads/presign", post(presign_handler))
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct PresignRequest {
    /// MIME type of the file, e.g. `"application/pdf"` or `"image/png"`.
    pub content_type: String,
    /// Optional key prefix for organisation, e.g. `"proof"`.
    /// Defaults to `"upload"`.
    pub prefix: Option<String>,
}

#[derive(Serialize)]
pub struct PresignResponse {
    /// The presigned URL — the client must PUT the file to this URL.
    pub upload_url: String,
    /// Stable R2 object key — pass this as `proof_key` when recording a payout.
    pub key: String,
}

// ── Handler ───────────────────────────────────────────────────────────────────

async fn presign_handler(
    State(state): State<AppState>,
    AuthClaims(_claims): AuthClaims,
    Json(body): Json<PresignRequest>,
) -> Result<ApiResponse<PresignResponse>, ApiError> {
    let prefix = body.prefix.as_deref().unwrap_or("upload");
    let key = format!("{prefix}/{}", Uuid::new_v4());

    let upload_url = state
        .storage
        .presign_put(&key, &body.content_type, PRESIGN_TTL_SECS)
        .await
        .map_err(|e| ApiError::Storage(e, "Failed to generate upload URL"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Presigned URL generated"),
        data: Some(PresignResponse { upload_url, key }),
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::{
        Router,
        body::Body,
        http::{Request, StatusCode},
    };
    use http_body_util::BodyExt;
    use serde_json::{Value, json};
    use sqlx::PgPool;
    use tower::ServiceExt;

    use std::time::Duration;

    use crate::{
        app::{AppState, PostgresDbPool},
        authentication::{password, rate_limit::RateLimiter},
        routes::app_router,
        storage::mock::InMemoryStore,
    };

    fn build_app_with_mock_store(pool: PgPool) -> Router {
        let state = AppState {
            db: PostgresDbPool::new(pool),
            jwt_secret: "test-secret".to_string(),
            storage: Arc::new(InMemoryStore::new("https://cdn.test")),
            auth_rate_limiter: Arc::new(RateLimiter::new(100, Duration::from_secs(15 * 60))),
            dummy_hash: Arc::new(
                password::hash_password("__dummy__").expect("dummy hash"),
            ),
        };
        Router::new()
            .nest("/api/v1", app_router())
            .with_state(state)
    }

    async fn read_body(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    /// Helper: register a user and return an access token.
    async fn register_and_login(app: &Router, email: &str) -> String {
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/register")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({
                            "first_name": "Test",
                            "last_name": "User",
                            "email": email,
                            "password": "password123"
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        let body = read_body(resp.into_body()).await;
        body["data"]["access_token"].as_str().unwrap().to_owned()
    }

    #[sqlx::test(migrations = "./migrations")]
    async fn presign_requires_auth(pool: PgPool) {
        let app = build_app_with_mock_store(pool);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/uploads/presign")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({ "content_type": "application/pdf" }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[sqlx::test(migrations = "./migrations")]
    async fn presign_returns_upload_url_and_key(pool: PgPool) {
        let app = build_app_with_mock_store(pool);
        let token = register_and_login(&app, "user@presign.test").await;

        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/uploads/presign")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {token}"))
                    .body(Body::from(
                        json!({ "content_type": "application/pdf" }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = read_body(resp.into_body()).await;
        assert_eq!(body["status"], true);

        let upload_url = body["data"]["upload_url"].as_str().unwrap();
        let key = body["data"]["key"].as_str().unwrap();

        // Mock store returns deterministic URL.
        assert!(
            upload_url.starts_with("https://put.mock/"),
            "unexpected url: {upload_url}"
        );
        assert!(upload_url.contains("sig=testtoken"));

        // Key defaults to "upload/<uuid>" when no prefix is given.
        assert!(key.starts_with("upload/"), "unexpected key: {key}");
    }

    #[sqlx::test(migrations = "./migrations")]
    async fn presign_respects_custom_prefix(pool: PgPool) {
        let app = build_app_with_mock_store(pool);
        let token = register_and_login(&app, "user@prefix.test").await;

        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/uploads/presign")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {token}"))
                    .body(Body::from(
                        json!({
                            "content_type": "image/png",
                            "prefix": "proof"
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = read_body(resp.into_body()).await;
        let key = body["data"]["key"].as_str().unwrap();
        assert!(
            key.starts_with("proof/"),
            "expected prefix 'proof/', got: {key}"
        );
    }
}
