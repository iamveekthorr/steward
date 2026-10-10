use crate::app::AppState;
use axum::{Router, routing::get};
mod admin;
mod auth;
mod manager;
mod uploads;
mod users;
mod worker;

pub fn app_router() -> Router<AppState> {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .merge(auth::router())
        .merge(users::router())
        .merge(manager::router())
        .merge(worker::router())
        .merge(uploads::router())
        .merge(admin::router())
}
