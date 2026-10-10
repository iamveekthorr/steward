use crate::enums::{payment_method::PaymentMethod, preferred_currency::PreferredCurrency};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Deserialize, Serialize, Debug, FromRow)]
pub struct LinkPaymentDetails {
    pub id: Uuid,
    pub link_id: Uuid,
    pub payment_method: PaymentMethod,
    pub bank_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub preferred_currency: PreferredCurrency,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: Option<chrono::DateTime<Utc>>,
}
