use axum::Router;
use dotenvy::dotenv;
use serde::Deserialize;
use sqlx::PgPool;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

mod app;
mod enums;
mod models;
mod routes;
mod utils;

#[derive(Deserialize, Debug, Clone)]
struct Config {
    postgres_user: String,
    postgres_password: String,
    postgres_db: String,
    app_port: u32,
    postgres_host: String,
    postgres_db_port: u32,
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

    match dotenv() {
        Ok(_) => tracing::info!("Env loaded"),
        Err(err) => {
            tracing::error!("Failed to load env variables: {:#}", err);
            std::process::exit(1);
        }
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

    let state = app::AppState {
        db: app::PostgresDbPool::new(pool),
    };

    let app = Router::new()
        .nest("/api/v1/", routes::app_router())
        .with_state(state)
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

    match axum::serve(listener, app)
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
