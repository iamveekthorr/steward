use crate::enums::{device_status::DeviceStatus, device_type::DeviceType};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Devices {
    pub id: Uuid,
    pub manager_id: Uuid,
    pub device_type: DeviceType,
    pub name: String,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub status: DeviceStatus,
    pub current_link_id: Option<Uuid>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: Option<chrono::DateTime<Utc>>,
}
