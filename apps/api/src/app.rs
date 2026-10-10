use std::sync::Arc;

use sqlx::PgPool;

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
}
