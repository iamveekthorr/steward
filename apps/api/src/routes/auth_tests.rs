//! Integration tests for the forced-password-change flow and auth endpoints.
//!
//! Each test spins up a real Postgres instance (via `#[sqlx::test]`) with all
//! migrations applied. The app is built with an in-memory object store and a
//! generous rate-limiter so the tests are not rate-limited.

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::time::Duration;

    use std::net::SocketAddr;

    use axum::{Router, body::Body, extract::connect_info::MockConnectInfo, http::{Request, StatusCode}};
    use http_body_util::BodyExt;
    use serde_json::{Value, json};
    use sqlx::PgPool;
    use tower::ServiceExt;

    use crate::{
        app::{AppState, PostgresDbPool},
        authentication::{password, rate_limit::RateLimiter},
        models::auth::{AuthRepository, EMAIL_PROVIDER},
        routes::app_router,
        storage::mock::InMemoryStore,
    };

    // ── App builder ───────────────────────────────────────────────────────────

    fn build_app(pool: PgPool) -> Router {
        let (ws_tx, _) = tokio::sync::broadcast::channel(16);
        let state = AppState {
            db: PostgresDbPool::new(pool),
            jwt_secret: "test-secret".to_string(),
            storage: Arc::new(InMemoryStore::new("https://cdn.test")),
            auth_rate_limiter: Arc::new(RateLimiter::new(1000, Duration::from_secs(900))),
            dummy_hash: Arc::new(password::hash_password("__dummy__").expect("dummy hash")),
            ws_tx,
            lemfi_payment_details: Arc::new(String::new()),
        };
        Router::new()
            .nest("/api/v1", app_router(state.clone()))
            .with_state(state)
            .layer(MockConnectInfo(SocketAddr::from(([127, 0, 0, 1], 0))))
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    async fn read_body(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    async fn post_json(app: &Router, uri: &str, payload: Value) -> (StatusCode, Value) {
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(uri)
                    .header("Content-Type", "application/json")
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = resp.status();
        let body = read_body(resp.into_body()).await;
        (status, body)
    }

    async fn json_with_bearer(
        app: &Router,
        method: &str,
        uri: &str,
        token: &str,
        payload: Value,
    ) -> (StatusCode, Value) {
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {token}"))
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = resp.status();
        let body = read_body(resp.into_body()).await;
        (status, body)
    }

    async fn post_json_with_bearer(
        app: &Router,
        uri: &str,
        token: &str,
        payload: Value,
    ) -> (StatusCode, Value) {
        json_with_bearer(app, "POST", uri, token, payload).await
    }

    async fn patch_json_with_bearer(
        app: &Router,
        uri: &str,
        token: &str,
        payload: Value,
    ) -> (StatusCode, Value) {
        json_with_bearer(app, "PATCH", uri, token, payload).await
    }

    /// Register a user and bypass email verification by updating the DB directly.
    async fn register_verified(pool: &PgPool, email: &str, password: &str) {
        sqlx::query(
            "INSERT INTO users (first_name, last_name, email) VALUES ('Test', 'User', $1)",
        )
        .bind(email)
        .execute(pool)
        .await
        .unwrap();

        let hash = password::hash_password(password).unwrap();
        sqlx::query(
            "INSERT INTO auth_identities (user_id, provider, provider_user_id, password_hash, email_verified)
             SELECT id, $2, $3, $4, TRUE FROM users WHERE email = $3",
        )
        .bind(email)
        .bind(EMAIL_PROVIDER)
        .bind(email)
        .bind(&hash)
        .execute(pool)
        .await
        .unwrap();
    }

    /// Login and return the access token from the response body.
    async fn login_and_get_token(app: &Router, email: &str, password: &str) -> (StatusCode, Value) {
        post_json(
            app,
            "/api/v1/auth/login",
            json!({ "email": email, "password": password }),
        )
        .await
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. must_change_password flag defaults to false for normal registrations
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn normal_login_must_change_password_is_false(pool: PgPool) {
        register_verified(&pool, "normal@test.com", "password123").await;
        let app = build_app(pool);
        let (status, body) = login_and_get_token(&app, "normal@test.com", "password123").await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["data"]["must_change_password"], false);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. create_account_with_default_password sets must_change_password = true
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn provisioned_account_must_change_password_is_true(pool: PgPool) {
        let db = PostgresDbPool::new(pool.clone());
        let hash = password::hash_password("TempPass123!").unwrap();

        db.create_account_with_default_password("Alice", "Smith", "alice@test.com", &hash)
            .await
            .unwrap();

        let flag: bool = sqlx::query_scalar(
            "SELECT must_change_password FROM auth_identities WHERE provider_user_id = $1",
        )
        .bind("alice@test.com")
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(flag, "must_change_password should be TRUE after provisioning");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Login with a provisioned account returns must_change_password = true
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn provisioned_login_must_change_password_is_true(pool: PgPool) {
        let db = PostgresDbPool::new(pool.clone());
        let temp_pass = "TempPass456!";
        let hash = password::hash_password(temp_pass).unwrap();

        db.create_account_with_default_password("Bob", "Jones", "bob@test.com", &hash)
            .await
            .unwrap();

        let app = build_app(pool);
        let (status, body) = login_and_get_token(&app, "bob@test.com", temp_pass).await;

        assert_eq!(status, StatusCode::OK, "login should succeed: {body}");
        assert_eq!(
            body["data"]["must_change_password"], true,
            "provisioned accounts must report must_change_password = true"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Changing password clears the must_change_password flag
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn changing_password_clears_must_change_flag(pool: PgPool) {
        let db = PostgresDbPool::new(pool.clone());
        let temp_pass = "TempPass789!";
        let hash = password::hash_password(temp_pass).unwrap();

        db.create_account_with_default_password("Carol", "White", "carol@test.com", &hash)
            .await
            .unwrap();

        let app = build_app(pool.clone());

        // Log in to get access token.
        let (_, login_body) = login_and_get_token(&app, "carol@test.com", temp_pass).await;
        let token = login_body["data"]["access_token"].as_str().unwrap();

        // Change the password.
        let (change_status, change_body) = patch_json_with_bearer(
            &app,
            "/api/v1/auth/change-password",
            token,
            json!({
                "current_password": temp_pass,
                "new_password": "NewSecurePass1!"
            }),
        )
        .await;

        assert_eq!(
            change_status,
            StatusCode::OK,
            "change-password failed: {change_body}"
        );

        // Verify the flag is now cleared in the DB.
        let flag: bool = sqlx::query_scalar(
            "SELECT must_change_password FROM auth_identities WHERE provider_user_id = $1",
        )
        .bind("carol@test.com")
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(!flag, "must_change_password should be FALSE after changing");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Second login after password change returns must_change_password = false
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn login_after_password_change_flag_is_false(pool: PgPool) {
        let db = PostgresDbPool::new(pool.clone());
        let temp_pass = "TempOriginal1!";
        let hash = password::hash_password(temp_pass).unwrap();

        db.create_account_with_default_password("Dave", "Brown", "dave@test.com", &hash)
            .await
            .unwrap();

        let app = build_app(pool);

        // First login → get token.
        let (_, login_body) = login_and_get_token(&app, "dave@test.com", temp_pass).await;
        let token = login_body["data"]["access_token"].as_str().unwrap();

        // Change password.
        patch_json_with_bearer(
            &app,
            "/api/v1/auth/change-password",
            token,
            json!({
                "current_password": temp_pass,
                "new_password": "NewSecurePass2!"
            }),
        )
        .await;

        // Second login with new password.
        let (status, body) =
            login_and_get_token(&app, "dave@test.com", "NewSecurePass2!").await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            body["data"]["must_change_password"], false,
            "flag should be false after password was changed"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. get_must_change_password repo function
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn get_must_change_password_returns_correct_value(pool: PgPool) {
        let db = PostgresDbPool::new(pool.clone());
        let hash = password::hash_password("TempPassX1!").unwrap();

        let user = db
            .create_account_with_default_password("Eve", "Green", "eve@test.com", &hash)
            .await
            .unwrap();

        // Should be TRUE immediately after provisioning.
        let flag = db.get_must_change_password(user.id).await.unwrap();
        assert!(flag);

        // Clear and re-check.
        db.clear_must_change_password(user.id).await.unwrap();
        let flag_after = db.get_must_change_password(user.id).await.unwrap();
        assert!(!flag_after);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. clear_must_change_password is idempotent (already-false → still false)
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn clear_must_change_password_is_idempotent(pool: PgPool) {
        register_verified(&pool, "frank@test.com", "password123").await;
        let db = PostgresDbPool::new(pool.clone());

        let user_id: uuid::Uuid =
            sqlx::query_scalar("SELECT id FROM users WHERE email = $1")
                .bind("frank@test.com")
                .fetch_one(&pool)
                .await
                .unwrap();

        // Flag is already FALSE; clearing it should return false (no row changed)
        // but must not error.
        let cleared = db.clear_must_change_password(user_id).await.unwrap();
        assert!(!cleared, "nothing to clear — already false");

        // DB flag still false.
        let flag = db.get_must_change_password(user_id).await.unwrap();
        assert!(!flag);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Provisioned account: email is already verified (no verification needed)
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn provisioned_account_email_is_verified(pool: PgPool) {
        let db = PostgresDbPool::new(pool.clone());
        let hash = password::hash_password("TempPassY1!").unwrap();

        db.create_account_with_default_password("Grace", "Hall", "grace@test.com", &hash)
            .await
            .unwrap();

        let verified: bool = sqlx::query_scalar(
            "SELECT email_verified FROM auth_identities WHERE provider_user_id = $1",
        )
        .bind("grace@test.com")
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(verified, "admin-provisioned accounts should be email-verified");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Admin create-manager-account endpoint: 401 without admin token
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn create_manager_account_requires_admin_token(pool: PgPool) {
        let app = build_app(pool);
        let (status, _) = post_json(
            &app,
            "/api/v1/admin/managers/create-account",
            json!({
                "first_name": "New",
                "last_name": "Manager",
                "email": "mgr@test.com"
            }),
        )
        .await;

        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Admin create-manager-account endpoint: success with admin token
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn create_manager_account_with_admin_token(pool: PgPool) {
        use crate::authentication::jwt::{make_claims, sign_access_token};

        // Mint an admin JWT directly (no DB row needed for the token check itself).
        let claims = make_claims("00000000-0000-0000-0000-000000000001", "admin", None);
        let token = sign_access_token(&claims, "test-secret").unwrap();

        let app = build_app(pool);
        let (status, body) = post_json_with_bearer(
            &app,
            "/api/v1/admin/managers/create-account",
            &token,
            json!({
                "first_name": "New",
                "last_name": "Manager",
                "email": "new_mgr@test.com"
            }),
        )
        .await;

        assert_eq!(status, StatusCode::CREATED, "unexpected: {body}");
        assert_eq!(body["status"], true);
        // Response must include temporary_password.
        let temp_pw = body["data"]["temporary_password"].as_str().unwrap();
        assert_eq!(temp_pw.len(), 16, "expected 16-char temp password");
        assert!(body["data"]["user_id"].as_str().is_some());
        assert!(body["data"]["manager_id"].as_str().is_some());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Manager create-link-with-password: success creates active link
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn create_link_with_password_creates_active_link(pool: PgPool) {
        use crate::authentication::jwt::{make_claims, sign_access_token};

        // Insert a manager user so the route can resolve the manager_id.
        let manager_user_id: uuid::Uuid = sqlx::query_scalar(
            "INSERT INTO users (first_name, last_name, email) VALUES ('Mgr', 'One', 'mgrx@test.com') RETURNING id",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        sqlx::query("INSERT INTO managers (user_id) VALUES ($1)")
            .bind(manager_user_id)
            .execute(&pool)
            .await
            .unwrap();

        // Approve links quota so we don't hit the free-quota block.
        sqlx::query("UPDATE managers SET links_quota_approved = TRUE WHERE user_id = $1")
            .bind(manager_user_id)
            .execute(&pool)
            .await
            .unwrap();

        let claims = make_claims(&manager_user_id.to_string(), "manager", None);
        let token = sign_access_token(&claims, "test-secret").unwrap();

        let app = build_app(pool.clone());
        let (status, body) = post_json_with_bearer(
            &app,
            "/api/v1/manager/links/create-with-password",
            &token,
            json!({
                "worker_first_name": "Worker",
                "worker_last_name": "One",
                "worker_email": "worker1@test.com",
                "job_type": "domestic",
                "start_date": "2025-01-01T00:00:00Z",
                "home_country": "NG",
                "work_country": "GB"
            }),
        )
        .await;

        assert_eq!(status, StatusCode::CREATED, "unexpected: {body}");
        let temp_pw = body["data"]["temporary_password"].as_str().unwrap();
        assert_eq!(temp_pw.len(), 16);

        // The link should be active immediately.
        let link_id: uuid::Uuid =
            uuid::Uuid::parse_str(body["data"]["link_id"].as_str().unwrap()).unwrap();
        let link_status: String =
            sqlx::query_scalar("SELECT status::TEXT FROM links WHERE id = $1")
                .bind(link_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(link_status, "active");

        // Worker auth_identity should have must_change_password = TRUE.
        let flag: bool = sqlx::query_scalar(
            "SELECT must_change_password FROM auth_identities WHERE provider_user_id = $1",
        )
        .bind("worker1@test.com")
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(flag);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. create_link_with_password rejects duplicate email
    // ─────────────────────────────────────────────────────────────────────────

    #[sqlx::test(migrations = "./migrations")]
    async fn create_link_with_password_rejects_existing_email(pool: PgPool) {
        use crate::authentication::jwt::{make_claims, sign_access_token};

        // Pre-create the worker account.
        register_verified(&pool, "taken@test.com", "SomePass123!").await;

        // Create a manager.
        let manager_user_id: uuid::Uuid = sqlx::query_scalar(
            "INSERT INTO users (first_name, last_name, email) VALUES ('Mgr', 'Two', 'mgr2@test.com') RETURNING id",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO managers (user_id) VALUES ($1)")
            .bind(manager_user_id)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE managers SET links_quota_approved = TRUE WHERE user_id = $1")
            .bind(manager_user_id)
            .execute(&pool)
            .await
            .unwrap();

        let claims = make_claims(&manager_user_id.to_string(), "manager", None);
        let token = sign_access_token(&claims, "test-secret").unwrap();

        let app = build_app(pool);
        let (status, _) = post_json_with_bearer(
            &app,
            "/api/v1/manager/links/create-with-password",
            &token,
            json!({
                "worker_first_name": "Existing",
                "worker_last_name": "Worker",
                "worker_email": "taken@test.com",
                "job_type": "domestic",
                "start_date": "2025-01-01T00:00:00Z",
                "home_country": "NG",
                "work_country": "GB"
            }),
        )
        .await;

        assert_eq!(status, StatusCode::CONFLICT);
    }
}
