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

use steward::{
    app::{AppState, PostgresDbPool},
    routes::app_router,
    storage::mock::InMemoryStore,
};

const JWT_SECRET: &str = "integration-test-secret";

fn build_app(pool: PgPool) -> Router {
    let state = AppState {
        db: PostgresDbPool::new(pool),
        jwt_secret: JWT_SECRET.to_string(),
        storage: Arc::new(InMemoryStore::new("https://cdn.test")),
    };
    Router::new()
        .nest("/api/v1", app_router())
        .with_state(state)
}

async fn read_body(body: Body) -> Value {
    let bytes = body.collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

// --- register ---

#[sqlx::test(migrations = "./migrations")]
async fn register_success(pool: PgPool) {
    let app = build_app(pool);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "first_name": "Victor",
                        "last_name": "O",
                        "email": "victor@steward.test",
                        "password": "password123"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = read_body(response.into_body()).await;
    assert_eq!(body["status"], true);
    assert!(body["data"]["access_token"].is_string());
    assert!(body["data"]["refresh_token"].is_string());
}

#[sqlx::test(migrations = "./migrations")]
async fn register_duplicate_email_returns_conflict(pool: PgPool) {
    let app = build_app(pool);
    let payload = json!({
        "first_name": "Victor",
        "last_name": "O",
        "email": "duplicate@steward.test",
        "password": "password123"
    })
    .to_string();

    // First registration succeeds
    let first = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(payload.clone()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::CREATED);

    // Second registration with same email conflicts
    let second = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(payload))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second.status(), StatusCode::CONFLICT);
}

// --- login ---

#[sqlx::test(migrations = "./migrations")]
async fn login_success(pool: PgPool) {
    let app = build_app(pool);

    // Register first
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "first_name": "Victor",
                        "last_name": "O",
                        "email": "login@steward.test",
                        "password": "password123"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "email": "login@steward.test",
                        "password": "password123"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    assert_eq!(body["status"], true);
    assert!(body["data"]["access_token"].is_string());
}

#[sqlx::test(migrations = "./migrations")]
async fn login_wrong_password_returns_unauthorized(pool: PgPool) {
    let app = build_app(pool);

    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "first_name": "Victor",
                        "last_name": "O",
                        "email": "wrongpass@steward.test",
                        "password": "correct_password"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "email": "wrongpass@steward.test",
                        "password": "wrong_password"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrations = "./migrations")]
async fn login_unknown_email_returns_unauthorized(pool: PgPool) {
    let app = build_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/login")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "email": "ghost@steward.test",
                        "password": "any_password"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// --- refresh ---

#[sqlx::test(migrations = "./migrations")]
async fn refresh_valid_token_returns_new_access_token(pool: PgPool) {
    let app = build_app(pool);

    let reg = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "first_name": "Victor",
                        "last_name": "O",
                        "email": "refresh@steward.test",
                        "password": "password123"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    let reg_body = read_body(reg.into_body()).await;
    let refresh_token = reg_body["data"]["refresh_token"]
        .as_str()
        .unwrap()
        .to_string();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/refresh")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({ "refresh_token": refresh_token }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    assert!(body["data"]["access_token"].is_string());
}

#[sqlx::test(migrations = "./migrations")]
async fn refresh_nonexistent_token_returns_unauthorized(pool: PgPool) {
    let app = build_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/refresh")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({ "refresh_token": "00000000-0000-0000-0000-000000000000" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// --- logout ---

#[sqlx::test(migrations = "./migrations")]
async fn logout_requires_auth_header(pool: PgPool) {
    let app = build_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/logout")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrations = "./migrations")]
async fn logout_with_valid_token_succeeds(pool: PgPool) {
    let app = build_app(pool);

    let reg = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "first_name": "Victor",
                        "last_name": "O",
                        "email": "logout@steward.test",
                        "password": "password123"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    let reg_body = read_body(reg.into_body()).await;
    let access_token = reg_body["data"]["access_token"]
        .as_str()
        .unwrap()
        .to_string();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/logout")
                .header("Authorization", format!("Bearer {}", access_token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
