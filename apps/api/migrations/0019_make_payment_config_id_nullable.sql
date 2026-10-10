-- Allow payouts to be recorded without a payment configuration (ad-hoc payments).
ALTER TABLE payouts ALTER COLUMN payment_config_id DROP NOT NULL;
