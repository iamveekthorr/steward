use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "router_type", rename_all = "snake_case")]
pub enum RouterType {
    Flint,
    GliNet,
    Others,
}
