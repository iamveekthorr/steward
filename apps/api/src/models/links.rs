use crate::enums::link_status::LinkStatus;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Serialize, Deserialize, FromRow, Debug)]
pub struct Links {
    pub id: Uuid,
    pub manager_id: Uuid,
    pub user_id: Uuid,
    pub job_type: String,
    pub status: LinkStatus,
    pub start_date: chrono::DateTime<Utc>,
    pub end_date: Option<chrono::DateTime<Utc>>,

    pub home_country: String,
    pub home_city: Option<String>,
    pub home_state_province: Option<String>,

    pub work_country: String,
    pub work_city: Option<String>,
    pub work_state_province: Option<String>,

    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: Option<chrono::DateTime<Utc>>,
}
