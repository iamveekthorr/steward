use axum::{Router, middleware, routing::get};
use crate::app::AppState;
mod admin;
mod auth;
mod auth_tests;
mod manager;
pub mod subscriptions;
mod uploads;
mod users;
mod worker;
mod ws;

pub fn app_router(state: AppState) -> Router<AppState> {
    // Manager routes are wrapped with the subscription guard so that
    // managers without an active subscription receive 402 Payment Required.
    let manager_routes = manager::router()
        .layer(middleware::from_fn_with_state(
            state,
            subscriptions::subscription_guard,
        ));

    Router::new()
        .route("/health", get(|| async { "ok" }))
        .merge(auth::router())
        .merge(users::router())
        .merge(manager_routes)
        .merge(worker::router())
        .merge(uploads::router())
        .merge(admin::router())
        .merge(subscriptions::router())
        .merge(ws::router())
}
