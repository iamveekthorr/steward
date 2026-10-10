use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "link_status", rename_all = "snake_case")]
pub enum LinkStatus {
    Pending,
    Active,
    Inactive,
    Suspended,
    Terminated,
}
