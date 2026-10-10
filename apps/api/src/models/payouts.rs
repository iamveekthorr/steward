use crate::enums::payout_status::PayoutStatus;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Deserialize, Serialize, Debug, FromRow)]
pub struct Payout {
    pub id: Uuid,
    pub link_id: Uuid,
    pub paid_by: Uuid,
    pub payment_config_id: Uuid,
    pub period_start: chrono::DateTime<Utc>,
    pub period_end: chrono::DateTime<Utc>,
    pub base_amount: i64,
    pub overtime_amount: Option<i64>,
    pub bonus_amount: Option<i64>,
    pub total_amount: i64,
    pub currency: String,
    pub proof_of_payment: Option<String>,
    pub notes: Option<String>,
    pub status: PayoutStatus,
    pub paid_at: chrono::DateTime<Utc>,
    pub created_at: chrono::DateTime<Utc>,
}
