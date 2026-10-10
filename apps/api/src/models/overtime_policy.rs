use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct OvertimePolicy {
    pub id: Uuid,
    pub manager_id: Uuid,
    pub name: String,
    pub overtime_enabled: bool,
    pub multiplier: Option<f64>,
    pub flat_rate: Option<i64>,
    pub threshold_hours: Option<i32>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: Option<chrono::DateTime<Utc>>,
}
