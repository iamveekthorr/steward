use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Deserialize, Serialize, Debug, FromRow)]
pub struct DeviceAssignment {
    pub id: Uuid,
    pub device_id: Uuid,
    pub link_id: Uuid,
    pub assigned_by: Uuid,
    pub assigned_at: chrono::DateTime<Utc>,
    pub returned_at: Option<chrono::DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
}
