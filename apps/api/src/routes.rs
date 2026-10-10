use crate::app::AppState;
use axum::Router;
mod users;

pub fn app_router() -> Router<AppState> {
    Router::new().merge(users::router())
}
