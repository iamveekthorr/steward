use crate::enums::{device_status::DeviceStatus, router_type::RouterType};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Deserialize, Serialize, Debug, FromRow)]
pub struct RouterGateways {
    pub id: Uuid,
    pub manager_id: Uuid,
    pub name: String,
    pub routes_to: String,
    pub ip_addr: String,
    pub router_type: RouterType,
    pub status: DeviceStatus,
    pub current_link_id: Option<Uuid>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: Option<chrono::DateTime<Utc>>,
}
