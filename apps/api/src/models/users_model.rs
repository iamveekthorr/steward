use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

use crate::app::PostgresDbPool;

#[derive(Serialize, Debug, FromRow, Deserialize)]
pub struct UsersDto {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub created_at: DateTime<Utc>,
    updated_at: Option<DateTime<Utc>>,
}

pub trait UsersRepository {
    async fn find_all(&self) -> Result<Vec<UsersDto>, sqlx::Error>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<UsersDto>, sqlx::Error>;
}

impl UsersRepository for PostgresDbPool {
    async fn find_all(&self) -> Result<Vec<UsersDto>, sqlx::Error> {
        sqlx::query_as::<_, UsersDto>("SELECT * FROM users")
            .fetch_all(&self.pool)
            .await
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<UsersDto>, sqlx::Error> {
        sqlx::query_as::<_, UsersDto>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
    }
}
