use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::broadcast;

use axum::{Router, http::Method};
use dotenvy::dotenv;
use serde::Deserialize;
use sqlx::PgPool;
use tower_http::{
    cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

mod app;
mod authentication;
mod email;
mod enums;
mod errors;
mod models;
mod routes;
mod storage;
mod utils;

#[derive(Deserialize, Debug, Clone)]
struct Config {
    // DATABASE_URL_UNPOOLED: direct (non-pooled) Neon connection — preferred for
    // SQLx because PgPool manages its own pool and prepared statements require a
    // direct connection (PgBouncer transaction mode does not support them).
    // DATABASE_URL: pooled Neon URL — accepted as fallback, or for non-Neon setups.
    database_url_unpooled: Option<String>,
    database_url: Option<String>,
    postgres_user: Option<String>,
    postgres_password: Option<String>,
    postgres_db: Option<String>,
    app_port: u32,
    postgres_host: Option<String>,
    postgres_db_port: Option<u32>,
    jwt_secret: String,
    /// Comma-separated list of allowed CORS origins, e.g. `http://localhost:3001,https://app.example.com`
    #[serde(default = "default_cors_origin")]
    allowed_origin: String,
    /// Resend API key for transactional email (subscription warnings, etc.)
    #[serde(default)]
    resend_api_key: String,
    /// Email address to notify when a manager's subscription is expiring
    #[serde(default = "default_admin_email")]
    admin_email: String,
    /// LemFi account details shown to managers so they know where to send payment.
    /// Format: free-form text, e.g. "Name: Victor\nAccount: 123..."
    #[serde(default)]
    lemfi_payment_details: String,
    // Cloudflare R2 object storage
    s3_api_url: String,
    r2_access_key_id: String,
    r2_secret_access_key: String,
    r2_bucket: String,
    /// Public base URL for served objects, e.g. `https://cdn.example.com`
    r2_public_url: String,
}

fn default_cors_origin() -> String {
    String::from("http://localhost:3001")
}

fn default_admin_email() -> String {
    String::from("admin@steward.app")
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(match EnvFilter::try_from_default_env() {
            Ok(filter) => filter,
            Err(_) => EnvFilter::new("info"),
        })
        .init();

    // .env is optional — production environments (Render, etc.) inject vars directly.
    match dotenv() {
        Ok(_) => tracing::info!("Loaded .env"),
        Err(_) => tracing::info!("No .env file found, using environment variables"),
    }

    let config = match envy::from_env::<Config>() {
        Ok(cfg) => cfg,
        Err(e) => {
            tracing::error!("Could not parse config: {:?}", e);
            std::process::exit(1);
        }
    };

    // Prefer DATABASE_URL_UNPOOLED (direct) so SQLx prepared statements work.
    // Fall back to DATABASE_URL, then individual POSTGRES_* vars.
    let db_url = match config.database_url_unpooled.or(config.database_url) {
        Some(url) => url,
        None => match (
            config.postgres_user.as_deref(),
            config.postgres_password.as_deref(),
            config.postgres_host.as_deref(),
            config.postgres_db_port,
            config.postgres_db.as_deref(),
        ) {
            (Some(user), Some(password), Some(host), Some(port), Some(db)) => {
                format!("postgres://{}:{}@{}:{}/{}", user, password, host, port, db)
            }
            _ => {
                tracing::error!(
                    "Set DATABASE_URL, or set all of: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_DB_PORT, POSTGRES_DB"
                );
                std::process::exit(1);
            }
        },
    };

    let pool = match PgPool::connect(&db_url).await {
        Ok(connection_pool) => {
            tracing::info!("Connected to database");
            connection_pool
        }
        Err(e) => {
            tracing::error!("Could not connect to database: {}", e);
            std::process::exit(1);
        }
    };

    if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
        tracing::error!("Migration failed: {}", e);
        std::process::exit(1);
    }
    tracing::info!("Migrations applied");

    let r2 = storage::r2::R2Client::new(
        &config.s3_api_url,
        &config.r2_access_key_id,
        &config.r2_secret_access_key,
        &config.r2_bucket,
        &config.r2_public_url,
    );

    // Rate limiter: 10 auth attempts per IP per 15 minutes.
    let auth_rate_limiter = Arc::new(authentication::rate_limit::RateLimiter::new(
        10,
        Duration::from_secs(15 * 60),
    ));

    // Generate a dummy Argon2id hash once at startup. The login handler always
    // calls verify_password — using this hash when no identity is found — so the
    // response time is identical whether or not the email exists, preventing
    // user enumeration via timing.
    let dummy_hash = Arc::new(
        authentication::password::hash_password("__dummy_timing_sentinel__")
            .expect("failed to generate dummy password hash at startup"),
    );

    let (ws_tx, _) = broadcast::channel::<app::WsEvent>(1024);

    let state = app::AppState {
        db: app::PostgresDbPool::new(pool),
        jwt_secret: config.jwt_secret.clone(),
        storage: Arc::new(r2),
        auth_rate_limiter,
        dummy_hash,
        ws_tx,
        lemfi_payment_details: Arc::new(config.lemfi_payment_details.clone()),
    };

    // Background task: check for expiring/expired subscriptions every 6 hours.
    if !config.resend_api_key.is_empty() {
        let bg_state = state.clone();
        let resend_key = config.resend_api_key.clone();
        let admin_email = config.admin_email.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(6 * 3600));
            loop {
                interval.tick().await;
                run_subscription_expiry_check(&bg_state, &resend_key, &admin_email).await;
            }
        });
    }

    // Build CORS layer from the configured origin list.
    let allowed_origins: Vec<axum::http::HeaderValue> = config
        .allowed_origin
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins))
        .allow_methods(AllowMethods::list([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ]))
        .allow_headers(AllowHeaders::mirror_request())
        .allow_credentials(true)
        .max_age(Duration::from_secs(3600));

    let app = Router::new()
        .nest("/api/v1/", routes::app_router(state.clone()))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{}", config.app_port);

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to bind {}: {}", addr, e);
            std::process::exit(1);
        }
    };

    tracing::info!("App is running on http://{}...", addr);

    // Keep the server running.
    match axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async {
        #[cfg(unix)]
        {
            use tokio::signal::unix::{SignalKind, signal};
            match (
                signal(SignalKind::terminate()),
                signal(SignalKind::interrupt()),
            ) {
                (Ok(mut sigterm), Ok(mut sigint)) => {
                    tokio::select! {
                        _ = sigterm.recv() => tracing::info!("Received SIGTERM, shutting down"),
                        _ = sigint.recv()  => tracing::info!("Received SIGINT, shutting down"),
                    }
                }
                (Err(e), _) | (_, Err(e)) => {
                    tracing::error!("Failed to install signal handler: {}", e);
                    std::process::exit(1);
                }
            }
        }
        #[cfg(not(unix))]
        {
            match tokio::signal::ctrl_c().await {
                Ok(_) => tracing::info!("Received ctrl+c, shutting down"),
                Err(e) => {
                    tracing::error!("Failed to listen for ctrl+c: {}", e);
                    std::process::exit(1);
                }
            }
        }
    })
    .await
    {
        Ok(_) => tracing::info!("Server stopped cleanly"),
        Err(e) => {
            tracing::error!("Server error: {}", e);
            std::process::exit(1);
        }
    }
}

/// Background task: runs every 6 hours.
/// 1. Finds subscriptions expiring within 36 hours that haven't had an email sent;
///    sends Victor an email and marks expiry_email_sent.
/// 2. Finds subscriptions past grace_until and transitions them to 'expired'.
async fn run_subscription_expiry_check(
    state: &app::AppState,
    resend_api_key: &str,
    admin_email: &str,
) {
    // Step 1: warn about upcoming expiries (within 36hrs, email not yet sent).
    let warn_rows = sqlx::query_as::<_, (uuid::Uuid, String, String, chrono::DateTime<chrono::Utc>)>(r#"
        SELECT s.id, u.first_name || ' ' || u.last_name, ai.provider_user_id, s.expires_at
        FROM subscriptions s
        JOIN managers m ON m.id = s.manager_id
        JOIN users u ON u.id = m.user_id
        LEFT JOIN auth_identities ai ON ai.user_id = m.user_id
        WHERE s.status = 'active'
          AND s.expires_at IS NOT NULL
          AND s.expires_at <= NOW() + INTERVAL '36 hours'
          AND NOT s.expiry_email_sent
    "#)
    .fetch_all(&state.db.pool)
    .await;

    match warn_rows {
        Ok(rows) => {
            for (sub_id, manager_name, manager_email, expires_at) in rows {
                let lemfi_account = "Name: Victor Okonkwo | Account: 999900004331 | Bank: Global Innovations Bank";
                let html = email::subscription_expiry_warning_html(
                    &manager_name,
                    &manager_email,
                    &expires_at.format("%Y-%m-%d %H:%M UTC").to_string(),
                    lemfi_account,
                );
                email::send(resend_api_key, admin_email, "Subscription expiring soon", &html).await;

                // Mark email sent regardless of delivery success (avoid spam on next tick).
                let _ = sqlx::query(
                    "UPDATE subscriptions SET expiry_email_sent = TRUE, updated_at = NOW() WHERE id = $1",
                )
                .bind(sub_id)
                .execute(&state.db.pool)
                .await;

                // Enter grace period on the subscription.
                let _ = sqlx::query(r#"
                    UPDATE subscriptions
                    SET grace_until = expires_at + INTERVAL '36 hours', updated_at = NOW()
                    WHERE id = $1 AND grace_until IS NULL
                "#)
                .bind(sub_id)
                .execute(&state.db.pool)
                .await;
            }
        }
        Err(e) => tracing::error!("Subscription expiry check failed: {e}"),
    }

    // Step 2: expire subscriptions whose grace period has passed.
    let _ = sqlx::query(r#"
        UPDATE subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE status IN ('active', 'grace')
          AND grace_until IS NOT NULL
          AND grace_until < NOW()
    "#)
    .execute(&state.db.pool)
    .await;
}
