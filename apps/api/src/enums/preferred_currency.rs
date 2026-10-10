use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "preferred_currency", rename_all = "snake_case")]
pub enum PreferredCurrency {
    Ngn,
    Usd,
    Gbp,
    Eur,
    Cad,
}
