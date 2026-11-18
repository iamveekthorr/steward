use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "subscription_status", rename_all = "snake_case")]
pub enum SubscriptionStatus {
    PendingPayment,
    Active,
    Grace,
    Expired,
    Suspended,
}

impl SubscriptionStatus {
    pub fn is_allowed(&self) -> bool {
        matches!(self, SubscriptionStatus::Active | SubscriptionStatus::Grace)
    }
}
