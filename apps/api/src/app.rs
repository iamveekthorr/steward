use std::sync::Arc;

use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::{authentication::rate_limit::RateLimiter, storage::store::ObjectStore};

#[derive(Clone)]
pub struct PostgresDbPool {
    pub(crate) pool: PgPool,
}

impl PostgresDbPool {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// Events broadcast to all connected WebSocket clients.
#[derive(Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[allow(dead_code)]
pub enum WsEvent {
    ManagerVerified { manager_id: uuid::Uuid },
    ManagerSuspended { manager_id: uuid::Uuid },
    ManagerPending { manager_id: uuid::Uuid, email: String },
    PayoutRecorded { link_id: uuid::Uuid, amount: i64, currency: String },
    LinkCreated { link_id: uuid::Uuid, manager_id: uuid::Uuid },
}

#[derive(Clone)]
pub struct AppState {
    pub db: PostgresDbPool,
    pub jwt_secret: String,
    /// Object storage backend (R2 in production, in-memory mock in tests).
    pub storage: Arc<dyn ObjectStore>,
    /// Rate limiter for auth endpoints (login, forgot-password, resend-verification).
    /// 10 attempts per IP per 15 minutes.
    pub auth_rate_limiter: Arc<RateLimiter>,
    /// Pre-computed Argon2id hash used as a dummy target when no identity is found
    /// during login. Ensures verify_password always runs regardless of whether the
    /// email exists, preventing user enumeration via response-time differences.
    pub dummy_hash: Arc<String>,
    /// Broadcast channel for real-time WebSocket events.
    pub ws_tx: broadcast::Sender<WsEvent>,
    /// LemFi payment details shown to managers who need to pay their subscription.
    /// Set via LEMFI_PAYMENT_DETAILS env var.
    pub lemfi_payment_details: Arc<String>,
}
