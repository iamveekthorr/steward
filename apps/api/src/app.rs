use sqlx::PgPool;

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
}
