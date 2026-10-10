use std::future::Future;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::prelude::FromRow;
use uuid::Uuid;
use validator::Validate;

use crate::app::PostgresDbPool;
use crate::models::users_model::UsersDto;

/// Hash a refresh token with SHA-256 before storing or querying.
/// The raw token is only ever held in memory and returned to the client.
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

// --- Request / response DTOs ---

#[derive(Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 1, max = 100, message = "First name must be 1–100 characters"))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100, message = "Last name must be 1–100 characters"))]
    pub last_name: String,
    #[validate(email(message = "Invalid email address"), length(max = 255))]
    pub email: String,
    #[validate(length(min = 10, message = "Password must be at least 10 characters"))]
    pub password: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub verification_token: String,
}

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Deserialize, Validate)]
pub struct ForgotPasswordRequest {
    #[validate(email(message = "Invalid email address"))]
    pub email: String,
}

#[derive(Serialize)]
pub struct ForgotPasswordResponse {
    pub reset_token: String,
}

#[derive(Deserialize, Validate)]
pub struct ResetPasswordRequest {
    #[validate(length(min = 1, message = "Token is required"))]
    pub token: String,
    #[validate(length(min = 10, message = "Password must be at least 10 characters"))]
    pub new_password: String,
}

#[derive(Deserialize, Validate)]
pub struct ResendVerificationRequest {
    #[validate(email(message = "Invalid email address"))]
    pub email: String,
}

#[derive(Serialize)]
pub struct ResendVerificationResponse {
    pub verification_token: String,
}

#[derive(Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Invalid email address"))]
    pub email: String,
    #[validate(length(min = 1, message = "Password is required"))]
    pub password: String,
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

// --- DB row types ---

#[derive(FromRow)]
#[allow(dead_code)]
pub struct AuthIdentity {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider: String,
    pub provider_user_id: String,
    pub password_hash: Option<String>,
    pub email_verified: bool,
    pub email_verification_token: Option<Uuid>,
}

#[derive(FromRow)]
#[allow(dead_code)]
pub struct RefreshTokenRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

pub const EMAIL_PROVIDER: &str = "email";
pub const REFRESH_TOKEN_EXPIRY_DAYS: i64 = 30;
pub const RESET_TOKEN_EXPIRY_HOURS: i64 = 1;
pub const INVITE_TOKEN_EXPIRY_DAYS: i64 = 7;

pub fn refresh_token_expiry() -> DateTime<Utc> {
    Utc::now() + Duration::days(REFRESH_TOKEN_EXPIRY_DAYS)
}

pub fn reset_token_expiry() -> DateTime<Utc> {
    Utc::now() + Duration::hours(RESET_TOKEN_EXPIRY_HOURS)
}

pub fn invite_token_expiry() -> DateTime<Utc> {
    Utc::now() + Duration::days(INVITE_TOKEN_EXPIRY_DAYS)
}

// --- Invite DTOs ---

#[derive(Serialize)]
pub struct InviteInfo {
    pub manager_name: String,
    pub worker_email: String,
    pub job_type: String,
    pub start_date: DateTime<Utc>,
    pub base_amount: Option<i64>,
    pub currency: Option<String>,
    pub pay_schedule: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct ChangePasswordRequest {
    #[validate(length(min = 1, message = "Current password is required"))]
    pub current_password: String,
    #[validate(length(min = 10, message = "New password must be at least 10 characters"))]
    pub new_password: String,
}

#[derive(Deserialize, Validate)]
pub struct AcceptInviteRequest {
    #[validate(length(min = 1, message = "Token is required"))]
    pub token: String,
    #[validate(length(min = 10, message = "Password must be at least 10 characters"))]
    pub password: String,
}

#[derive(Serialize)]
pub struct AcceptInviteResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

// --- Repository trait ---

pub trait AuthRepository {
    fn register_user_with_email(
        &self,
        first_name: &str,
        last_name: &str,
        email: &str,
        password_hash: &str,
    ) -> impl Future<Output = Result<(UsersDto, Uuid), sqlx::Error>> + Send;

    fn find_identity_by_email(
        &self,
        email: &str,
    ) -> impl Future<Output = Result<Option<AuthIdentity>, sqlx::Error>> + Send;

    fn verify_email_token(
        &self,
        token: Uuid,
    ) -> impl Future<Output = Result<bool, sqlx::Error>> + Send;

    fn store_refresh_token(
        &self,
        user_id: Uuid,
        token: &str,
        expires_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<(), sqlx::Error>> + Send;

    fn find_refresh_token(
        &self,
        token: &str,
    ) -> impl Future<Output = Result<Option<RefreshTokenRow>, sqlx::Error>> + Send;

    fn revoke_all_user_tokens(
        &self,
        user_id: Uuid,
    ) -> impl Future<Output = Result<(), sqlx::Error>> + Send;

    fn find_user_role(
        &self,
        user_id: Uuid,
    ) -> impl Future<Output = Result<String, sqlx::Error>> + Send;

    /// Creates a password-reset token for the given email address.
    /// Returns `(first_name, reset_token)` if the email exists and has a verified email identity,
    /// or `None` if not found (caller should return success regardless to avoid enumeration).
    fn create_password_reset_token(
        &self,
        email: &str,
    ) -> impl Future<Output = Result<Option<(String, Uuid)>, sqlx::Error>> + Send;

    /// Updates the password hash for the identity matching the given reset token,
    /// provided the token has not expired. Clears the token on success.
    /// Returns `true` if a row was updated.
    fn reset_password(
        &self,
        token: Uuid,
        new_password_hash: &str,
    ) -> impl Future<Output = Result<bool, sqlx::Error>> + Send;

    /// Creates a new email-verification token for an unverified address.
    /// Returns `(first_name, token)` if found and still unverified, else `None`.
    fn resend_verification_token(
        &self,
        email: &str,
    ) -> impl Future<Output = Result<Option<(String, Uuid)>, sqlx::Error>> + Send;

    /// Finds a user_id by their email column in the users table.
    /// Used as a fallback when the worker has an OAuth identity (no email-provider auth_identity).
    fn find_user_id_by_email(
        &self,
        email: &str,
    ) -> impl Future<Output = Result<Option<Uuid>, sqlx::Error>> + Send;

    /// Creates a placeholder worker account for an uninvited email, along with an invite token.
    /// Returns `(user_id, invite_token)` on success.
    fn create_worker_invite(
        &self,
        worker_email: &str,
    ) -> impl Future<Output = Result<(Uuid, Uuid), sqlx::Error>> + Send;

    /// Looks up invite info by token. Returns `None` if the token is invalid or expired.
    fn get_invite_info(
        &self,
        token: Uuid,
    ) -> impl Future<Output = Result<Option<InviteInfo>, sqlx::Error>> + Send;

    /// Accepts an invite: sets password, marks email verified, clears invite token,
    /// activates the pending link. Returns `Some(user_id)` if successful.
    fn accept_invite(
        &self,
        token: Uuid,
        password_hash: &str,
    ) -> impl Future<Output = Result<Option<Uuid>, sqlx::Error>> + Send;

    /// Looks up an email identity by user_id. Used for change-password flows
    /// where the caller is already authenticated.
    fn find_identity_by_user_id(
        &self,
        user_id: Uuid,
    ) -> impl Future<Output = Result<Option<AuthIdentity>, sqlx::Error>> + Send;

    /// Updates the password hash for the given user_id. Returns `true` if updated.
    fn update_password_hash(
        &self,
        user_id: Uuid,
        new_password_hash: &str,
    ) -> impl Future<Output = Result<bool, sqlx::Error>> + Send;
}

impl AuthRepository for PostgresDbPool {
    async fn register_user_with_email(
        &self,
        first_name: &str,
        last_name: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<(UsersDto, Uuid), sqlx::Error> {
        let mut tx = match self.pool.begin().await {
            Ok(t) => t,
            Err(e) => return Err(e),
        };

        let user = match sqlx::query_as::<_, UsersDto>(
            "INSERT INTO users (first_name, last_name, email)
             VALUES ($1, $2, $3)
             RETURNING id, email, first_name, last_name, created_at, updated_at",
        )
        .bind(first_name)
        .bind(last_name)
        .bind(email)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(u) => u,
            Err(e) => {
                match tx.rollback().await {
                    Ok(()) => {}
                    Err(rollback_err) => {
                        tracing::error!("Rollback failed after user insert: {}", rollback_err);
                    }
                }
                return Err(e);
            }
        };

        let verification_token = Uuid::new_v4();

        match sqlx::query(
            "INSERT INTO auth_identities (user_id, provider, provider_user_id, password_hash, email_verification_token)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(user.id)
        .bind(EMAIL_PROVIDER)
        .bind(email)
        .bind(password_hash)
        .bind(verification_token)
        .execute(&mut *tx)
        .await
        {
            Ok(_) => {}
            Err(e) => {
                match tx.rollback().await {
                    Ok(()) => {}
                    Err(rollback_err) => {
                        tracing::error!("Rollback failed after identity insert: {}", rollback_err);
                    }
                }
                return Err(e);
            }
        };

        match tx.commit().await {
            Ok(()) => Ok((user, verification_token)),
            Err(e) => Err(e),
        }
    }

    async fn find_identity_by_email(
        &self,
        email: &str,
    ) -> Result<Option<AuthIdentity>, sqlx::Error> {
        sqlx::query_as::<_, AuthIdentity>(
            "SELECT id, user_id, provider, provider_user_id, password_hash,
                    email_verified, email_verification_token
             FROM auth_identities
             WHERE provider = $1 AND provider_user_id = $2",
        )
        .bind(EMAIL_PROVIDER)
        .bind(email)
        .fetch_optional(&self.pool)
        .await
    }

    async fn verify_email_token(&self, token: Uuid) -> Result<bool, sqlx::Error> {
        let rows = sqlx::query(
            "UPDATE auth_identities
             SET email_verified = TRUE, email_verification_token = NULL
             WHERE email_verification_token = $1 AND email_verified = FALSE",
        )
        .bind(token)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows > 0)
    }

    async fn store_refresh_token(
        &self,
        user_id: Uuid,
        token: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), sqlx::Error> {
        match sqlx::query(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)",
        )
        .bind(user_id)
        .bind(hash_token(token))
        .bind(expires_at)
        .execute(&self.pool)
        .await
        {
            Ok(_) => Ok(()),
            Err(e) => Err(e),
        }
    }

    async fn find_refresh_token(
        &self,
        token: &str,
    ) -> Result<Option<RefreshTokenRow>, sqlx::Error> {
        sqlx::query_as::<_, RefreshTokenRow>(
            "SELECT id, user_id, token_hash, expires_at, revoked_at
             FROM refresh_tokens
             WHERE token_hash = $1
               AND revoked_at IS NULL
               AND expires_at > NOW()",
        )
        .bind(hash_token(token))
        .fetch_optional(&self.pool)
        .await
    }

    async fn revoke_all_user_tokens(&self, user_id: Uuid) -> Result<(), sqlx::Error> {
        match sqlx::query(
            "UPDATE refresh_tokens
             SET revoked_at = NOW()
             WHERE user_id = $1 AND revoked_at IS NULL",
        )
        .bind(user_id)
        .execute(&self.pool)
        .await
        {
            Ok(_) => Ok(()),
            Err(e) => Err(e),
        }
    }

    async fn find_user_role(&self, user_id: Uuid) -> Result<String, sqlx::Error> {
        let is_manager: Option<bool> = sqlx::query_scalar(
            "SELECT TRUE FROM managers WHERE user_id = $1 LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if is_manager.is_some() {
            return Ok(String::from("manager"));
        }

        let is_link: Option<bool> = sqlx::query_scalar(
            "SELECT TRUE FROM links WHERE user_id = $1 AND status != 'terminated' LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if is_link.is_some() {
            return Ok(String::from("link"));
        }

        Ok(String::from("user"))
    }

    async fn create_password_reset_token(
        &self,
        email: &str,
    ) -> Result<Option<(String, Uuid)>, sqlx::Error> {
        let token = Uuid::new_v4();
        let expires_at = reset_token_expiry();

        let row: Option<(String,)> = sqlx::query_as(
            "UPDATE auth_identities ai
             SET password_reset_token = $1,
                 password_reset_token_expires_at = $2
             FROM users u
             WHERE ai.user_id = u.id
               AND ai.provider = $3
               AND ai.provider_user_id = $4
               AND ai.email_verified = TRUE
             RETURNING u.first_name",
        )
        .bind(token)
        .bind(expires_at)
        .bind(EMAIL_PROVIDER)
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|(first_name,)| (first_name, token)))
    }

    async fn reset_password(
        &self,
        token: Uuid,
        new_password_hash: &str,
    ) -> Result<bool, sqlx::Error> {
        let rows = sqlx::query(
            "UPDATE auth_identities
             SET password_hash = $1,
                 password_reset_token = NULL,
                 password_reset_token_expires_at = NULL
             WHERE password_reset_token = $2
               AND password_reset_token_expires_at > NOW()",
        )
        .bind(new_password_hash)
        .bind(token)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows > 0)
    }

    async fn resend_verification_token(
        &self,
        email: &str,
    ) -> Result<Option<(String, Uuid)>, sqlx::Error> {
        let token = Uuid::new_v4();

        let row: Option<(String,)> = sqlx::query_as(
            "UPDATE auth_identities ai
             SET email_verification_token = $1
             FROM users u
             WHERE ai.user_id = u.id
               AND ai.provider = $2
               AND ai.provider_user_id = $3
               AND ai.email_verified = FALSE
             RETURNING u.first_name",
        )
        .bind(token)
        .bind(EMAIL_PROVIDER)
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|(first_name,)| (first_name, token)))
    }

    async fn find_user_id_by_email(
        &self,
        email: &str,
    ) -> Result<Option<Uuid>, sqlx::Error> {
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(&self.pool)
            .await
    }

    async fn create_worker_invite(
        &self,
        worker_email: &str,
    ) -> Result<(Uuid, Uuid), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        let user_id: Uuid = sqlx::query_scalar(
            "INSERT INTO users (first_name, last_name, email)
             VALUES ('Invited', 'Worker', $1)
             RETURNING id",
        )
        .bind(worker_email)
        .fetch_one(&mut *tx)
        .await?;

        let invite_token = Uuid::new_v4();
        let expires_at = invite_token_expiry();

        sqlx::query(
            "INSERT INTO auth_identities
               (user_id, provider, provider_user_id, email_verified, invite_token, invite_token_expires_at)
             VALUES ($1, $2, $3, FALSE, $4, $5)",
        )
        .bind(user_id)
        .bind(EMAIL_PROVIDER)
        .bind(worker_email)
        .bind(invite_token)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok((user_id, invite_token))
    }

    async fn get_invite_info(
        &self,
        token: Uuid,
    ) -> Result<Option<InviteInfo>, sqlx::Error> {
        let row: Option<(String, String, String, DateTime<Utc>, Option<i64>, Option<String>, Option<String>)> =
            sqlx::query_as(
                "SELECT
                   CONCAT(mu.first_name, ' ', mu.last_name) AS manager_name,
                   ai.provider_user_id AS worker_email,
                   l.job_type,
                   l.start_date,
                   pc.base_amount,
                   pc.currency,
                   pc.pay_schedule::TEXT
                 FROM auth_identities ai
                 JOIN links l ON l.user_id = ai.user_id AND l.status = 'pending'
                 JOIN managers m ON m.id = l.manager_id
                 JOIN users mu ON mu.id = m.user_id
                 LEFT JOIN payment_configurations pc
                   ON pc.link_id = l.id AND pc.valid_until IS NULL
                 WHERE ai.invite_token = $1
                   AND ai.invite_token_expires_at > NOW()",
            )
            .bind(token)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|(manager_name, worker_email, job_type, start_date, base_amount, currency, pay_schedule)| {
            InviteInfo {
                manager_name,
                worker_email,
                job_type,
                start_date,
                base_amount,
                currency,
                pay_schedule,
            }
        }))
    }

    async fn accept_invite(
        &self,
        token: Uuid,
        password_hash: &str,
    ) -> Result<Option<Uuid>, sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        let row: Option<(Uuid,)> = sqlx::query_as(
            "UPDATE auth_identities
             SET password_hash = $1,
                 email_verified = TRUE,
                 invite_token = NULL,
                 invite_token_expires_at = NULL
             WHERE invite_token = $2
               AND invite_token_expires_at > NOW()
             RETURNING user_id",
        )
        .bind(password_hash)
        .bind(token)
        .fetch_optional(&mut *tx)
        .await?;

        let Some((user_id,)) = row else {
            tx.rollback().await?;
            return Ok(None);
        };

        sqlx::query(
            "UPDATE links SET status = 'active'
             WHERE user_id = $1 AND status = 'pending'",
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(Some(user_id))
    }

    async fn find_identity_by_user_id(
        &self,
        user_id: Uuid,
    ) -> Result<Option<AuthIdentity>, sqlx::Error> {
        sqlx::query_as::<_, AuthIdentity>(
            "SELECT id, user_id, provider, provider_user_id, password_hash,
                    email_verified, email_verification_token
             FROM auth_identities
             WHERE user_id = $1 AND provider = $2",
        )
        .bind(user_id)
        .bind(EMAIL_PROVIDER)
        .fetch_optional(&self.pool)
        .await
    }

    async fn update_password_hash(
        &self,
        user_id: Uuid,
        new_password_hash: &str,
    ) -> Result<bool, sqlx::Error> {
        let rows = sqlx::query(
            "UPDATE auth_identities
             SET password_hash = $1
             WHERE user_id = $2 AND provider = $3",
        )
        .bind(new_password_hash)
        .bind(user_id)
        .bind(EMAIL_PROVIDER)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows > 0)
    }
}
