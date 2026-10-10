use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "device_type", rename_all = "snake_case")]
pub enum DeviceType {
    Laptop,
    Cpu,
    Phone,
    Byod,
}
