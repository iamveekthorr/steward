use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "pay_schedule", rename_all = "snake_case")]
pub enum PaySchedule {
    Daily,
    Weekly,
    Biweekly,
    SemiMonthly,
    Monthly,
    Custom,
}
