use crate::enums::pay_schedule::PaySchedule;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PaymentConfiguration {
    pub id: Uuid,
    pub link_id: Uuid,
    pub configured_by: Uuid,
    pub pay_schedule: PaySchedule,
    pub pay_interval_count: Option<i32>,
    pub pay_day: Option<i16>,
    pub base_amount: i64,
    pub currency: String,
    pub overtime_policy_id: Option<Uuid>,
    pub cycle_anchor_date: chrono::DateTime<Utc>,
    pub next_due_date: chrono::DateTime<Utc>,
    pub valid_from: chrono::DateTime<Utc>,
    pub valid_until: Option<chrono::DateTime<Utc>>,
    pub created_at: chrono::DateTime<Utc>,
}
