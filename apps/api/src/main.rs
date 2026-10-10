use std::{net::SocketAddr, sync::Arc, time::Duration};

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
mod enums;
mod errors;
mod models;
mod routes;
mod storage;
mod utils;

#[derive(Deserialize, Debug, Clone)]
struct Config {
    postgres_user: String,
    postgres_password: String,
    postgres_db: String,
    app_port: u32,
    postgres_host: String,
    postgres_db_port: u32,
    jwt_secret: String,
    /// Comma-separated list of allowed CORS origins, e.g. `http://localhost:3001,https://app.example.com`
    #[serde(default = "default_cors_origin")]
    allowed_origin: String,
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

    let db_url = format!(
        "postgres://{}:{}@{}:{}/{}",
        config.postgres_user,
        config.postgres_password,
        config.postgres_host,
        config.postgres_db_port,
        config.postgres_db
    );

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

    let state = app::AppState {
        db: app::PostgresDbPool::new(pool),
        jwt_secret: config.jwt_secret.clone(),
        storage: Arc::new(r2),
        auth_rate_limiter,
        dummy_hash,
    };

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
        .nest("/api/v1/", routes::app_router())
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
