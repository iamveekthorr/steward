#![allow(dead_code)]
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "device_status", rename_all = "snake_case")]
pub enum DeviceStatus {
    WithManager,
    InTransit,
    WithLink,
    Offline,
    Lost,
}
