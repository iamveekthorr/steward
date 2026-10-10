use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, request::Parts},
};
use axum_extra::{
    TypedHeader,
    extract::CookieJar,
    headers::{Authorization, authorization::Bearer},
};
use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::utils::response::ApiResponse;

pub const ACCESS_TOKEN_EXPIRY_SECS: i64 = 900; // 15 minutes

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,  // user UUID
    pub role: String, // "user" | "manager" | "link"
    pub exp: i64,
    pub iat: i64,
}

pub fn make_claims(user_id: &str, role: &str) -> Claims {
    let now = Utc::now().timestamp();
    Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        iat: now,
        exp: now + ACCESS_TOKEN_EXPIRY_SECS,
    }
}

pub fn sign_access_token(
    claims: &Claims,
    secret: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify_access_token(
    token: &str,
    secret: &str,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    match decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    ) {
        Ok(data) => Ok(data.claims),
        Err(e) => Err(e),
    }
}

// Axum extractor — any handler that takes AuthClaims requires a valid JWT.
// Accepts the token from either:
//   1. `Cookie: access_token=<token>` (httpOnly cookie set by the API)
//   2. `Authorization: Bearer <token>` (legacy / non-browser clients)
// Cookie takes precedence.
pub struct AuthClaims(pub Claims);

/// Requires a valid JWT with role == "manager".
pub struct ManagerClaims(pub Claims);

/// Requires a valid JWT with role == "link" (worker).
pub struct WorkerClaims(pub Claims);

/// Requires a valid JWT with role == "admin".
pub struct AdminClaims(pub Claims);

impl<S> FromRequestParts<S> for AuthClaims
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiResponse<()>;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        // Try cookie first.
        let cookie_token = CookieJar::from_request_parts(parts, state)
            .await
            .ok()
            .and_then(|jar| jar.get("access_token").map(|c| c.value().to_owned()));

        // Fall back to Authorization: Bearer.
        let bearer_token = TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
            .await
            .ok()
            .map(|TypedHeader(Authorization(b))| b.token().to_owned());

        let token = cookie_token.or(bearer_token).ok_or_else(|| ApiResponse {
            http_status: StatusCode::UNAUTHORIZED,
            status: false,
            message: String::from("Missing or malformed Authorization header"),
            data: None,
        })?;

        match verify_access_token(&token, &app_state.jwt_secret) {
            Ok(claims) => Ok(AuthClaims(claims)),
            Err(_) => Err(ApiResponse {
                http_status: StatusCode::UNAUTHORIZED,
                status: false,
                message: String::from("Invalid or expired token"),
                data: None,
            }),
        }
    }
}

fn forbidden_role(required: &str) -> ApiResponse<()> {
    ApiResponse {
        http_status: StatusCode::FORBIDDEN,
        status: false,
        message: format!("Access denied: {} role required", required),
        data: None,
    }
}

impl<S> FromRequestParts<S> for ManagerClaims
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiResponse<()>;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let AuthClaims(claims) = AuthClaims::from_request_parts(parts, state).await?;
        if claims.role != "manager" {
            return Err(forbidden_role("manager"));
        }
        Ok(ManagerClaims(claims))
    }
}

impl<S> FromRequestParts<S> for WorkerClaims
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiResponse<()>;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let AuthClaims(claims) = AuthClaims::from_request_parts(parts, state).await?;
        if claims.role != "link" {
            return Err(forbidden_role("link"));
        }
        Ok(WorkerClaims(claims))
    }
}

impl<S> FromRequestParts<S> for AdminClaims
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiResponse<()>;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let AuthClaims(claims) = AuthClaims::from_request_parts(parts, state).await?;
        if claims.role != "admin" {
            return Err(forbidden_role("admin"));
        }
        Ok(AdminClaims(claims))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ACCESS_TOKEN_EXPIRY_SECS, Claims, make_claims, sign_access_token, verify_access_token,
    };
    use chrono::Utc;
    use jsonwebtoken::{EncodingKey, Header, encode};

    const SECRET: &str = "test-only-secret-never-use-in-production";

    #[test]
    fn sign_then_verify_roundtrip() {
        let claims = make_claims("user-123", "user");
        let token = sign_access_token(&claims, SECRET).unwrap();
        let decoded = verify_access_token(&token, SECRET).unwrap();
        assert_eq!(decoded.sub, "user-123");
        assert_eq!(decoded.role, "user");
    }

    #[test]
    fn verify_wrong_secret_fails() {
        let claims = make_claims("user-123", "user");
        let token = sign_access_token(&claims, SECRET).unwrap();
        assert!(verify_access_token(&token, "different-secret").is_err());
    }

    #[test]
    fn claims_exp_is_15_minutes_from_iat() {
        let claims = make_claims("user-123", "user");
        assert_eq!(claims.exp - claims.iat, ACCESS_TOKEN_EXPIRY_SECS);
    }

    #[test]
    fn verify_expired_token_fails() {
        let expired = Claims {
            sub: "user-123".to_string(),
            role: "user".to_string(),
            iat: Utc::now().timestamp() - 1000,
            exp: Utc::now().timestamp() - 120,
        };
        let token = encode(
            &Header::default(),
            &expired,
            &EncodingKey::from_secret(SECRET.as_bytes()),
        )
        .unwrap();
        assert!(verify_access_token(&token, SECRET).is_err());
    }

    #[test]
    fn verify_malformed_token_fails() {
        assert!(verify_access_token("not.a.jwt", SECRET).is_err());
    }
}
