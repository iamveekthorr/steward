use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize, FromRow)]
pub struct LinkManagerHistory {
    pub id: Uuid,
    pub link_id: Uuid,
    pub from_manager_id: Option<Uuid>,
    pub to_manager_id: Uuid,
    pub transferred_by: Uuid,
    pub worker_consented: bool,
    pub transfer_notes: Option<String>,
    pub effective_from: chrono::DateTime<Utc>,
    pub effective_until: Option<chrono::DateTime<Utc>>,
    pub created_at: chrono::DateTime<Utc>,
}
