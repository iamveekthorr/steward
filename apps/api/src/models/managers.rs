use crate::enums::manager_status::ManagerStatus;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize, FromRow)]
pub struct Managers {
    pub id: Uuid,
    pub user_id: Uuid,
    pub status: ManagerStatus,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<chrono::DateTime<Utc>>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: Option<chrono::DateTime<Utc>>,
}
