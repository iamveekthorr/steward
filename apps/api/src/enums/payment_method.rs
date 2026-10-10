use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, sqlx::Type)]
#[sqlx(type_name = "payment_method", rename_all = "snake_case")]
pub enum PaymentMethod {
    BankTransfer,
    DebitCard,
    MobileMoney,
    Cash,
}
