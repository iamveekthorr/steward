use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "manager_status", rename_all = "snake_case")]
pub enum ManagerStatus {
    Pending,
    Verified,
    Suspended,
    Revoked,
}
