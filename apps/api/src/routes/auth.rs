use axum::{
    Json, Router,
    extract::{ConnectInfo, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    routing::{get, patch, post},
};
use serde::Deserialize;
use std::net::SocketAddr;
use uuid::Uuid;

use crate::{
    app::AppState,
    authentication::{
        jwt::{ACCESS_TOKEN_EXPIRY_SECS, AuthClaims, make_claims, sign_access_token},
        password::{hash_password, verify_password},
    },
    errors::{ApiError, parse_user_id},
    models::auth::{
        AcceptInviteRequest, AcceptInviteResponse, AuthRepository, AuthResponse,
        ChangePasswordRequest, ForgotPasswordRequest, ForgotPasswordResponse, InviteInfo,
        LoginRequest, REFRESH_TOKEN_EXPIRY_DAYS, RefreshRequest, RegisterRequest, RegisterResponse,
        ResendVerificationRequest, ResendVerificationResponse, ResetPasswordRequest,
        VerifyEmailRequest, refresh_token_expiry,
    },
    utils::{response::ApiResponse, validated_json::ValidatedJson},
};

/// Free-tier link quota. Managers must be approved to exceed this.
pub const LINK_FREE_QUOTA: i64 = 5;

// Cookie attribute constants.
const ACCESS_COOKIE_TTL: i64 = ACCESS_TOKEN_EXPIRY_SECS; // 900 s
const REFRESH_COOKIE_TTL: i64 = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60; // 30 days

/// Build an `access_token` httpOnly cookie header value.
fn access_cookie(token: &str, secure: bool) -> String {
    let secure_flag = if secure { "; Secure" } else { "" };
    format!(
        "access_token={token}; HttpOnly{secure_flag}; SameSite=Lax; Path=/; Max-Age={ACCESS_COOKIE_TTL}"
    )
}

/// Build a `refresh_token` httpOnly cookie header value.
fn refresh_cookie(token: &str, secure: bool) -> String {
    let secure_flag = if secure { "; Secure" } else { "" };
    format!(
        "refresh_token={token}; HttpOnly{secure_flag}; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age={REFRESH_COOKIE_TTL}"
    )
}

/// Clear both auth cookies.
fn clear_cookies() -> (String, String) {
    (
        "access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0".to_string(),
        "refresh_token=; HttpOnly; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=0".to_string(),
    )
}

/// Returns `true` when the request comes from a localhost/loopback origin,
/// which means the `Secure` cookie flag would break things (HTTP only).
fn is_local(addr: Option<SocketAddr>) -> bool {
    addr.map(|a| a.ip().is_loopback()).unwrap_or(true)
}

#[derive(Deserialize)]
struct InviteTokenQuery {
    token: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
        .route("/auth/logout", post(logout))
        .route("/auth/verify-email", post(verify_email))
        .route("/auth/resend-verification", post(resend_verification))
        .route("/auth/forgot-password", post(forgot_password))
        .route("/auth/reset-password", post(reset_password))
        .route("/auth/change-password", patch(change_password))
        .route("/auth/invite-info", get(get_invite_info))
        .route("/auth/accept-invite", post(accept_invite))
}

/// Extract the caller's IP address from the request, preferring `X-Forwarded-For`.
fn caller_ip(headers: &HeaderMap, addr: Option<SocketAddr>) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| addr.map(|a| a.ip().to_string()))
        .unwrap_or_else(|| "unknown".to_string())
}

async fn register(
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<RegisterRequest>,
) -> Result<ApiResponse<RegisterResponse>, ApiError> {
    match state.db.find_identity_by_email(&body.email).await {
        Ok(Some(_)) => return Err(ApiError::Conflict("Email already registered".to_string())),
        Ok(None) => {}
        Err(e) => return Err(ApiError::Database(e, "Registration failed")),
    }

    let password_hash = hash_password(&body.password).map_err(|e| {
        tracing::error!("Password hashing failed: {e}");
        ApiError::Internal("Registration failed".to_string())
    })?;

    let (_, verification_token) = state
        .db
        .register_user_with_email(
            &body.first_name,
            &body.last_name,
            &body.email,
            &password_hash,
        )
        .await
        .map_err(|e| ApiError::Database(e, "Registration failed"))?;

    Ok(ApiResponse {
        http_status: StatusCode::CREATED,
        status: true,
        message: String::from("Account created. Please verify your email to continue."),
        data: Some(RegisterResponse {
            verification_token: verification_token.to_string(),
        }),
    })
}

async fn verify_email(
    State(state): State<AppState>,
    Json(body): Json<VerifyEmailRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let token = Uuid::parse_str(&body.token)
        .map_err(|_| ApiError::BadRequest("Invalid verification token".to_string()))?;

    let verified = state
        .db
        .verify_email_token(token)
        .await
        .map_err(|e| ApiError::Database(e, "Email verification failed"))?;

    if !verified {
        return Err(ApiError::BadRequest(
            "This link has already been used or has expired.".to_string(),
        ));
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Email verified successfully. You can now sign in."),
        data: None,
    })
}

async fn login(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    ValidatedJson(body): ValidatedJson<LoginRequest>,
) -> Result<(HeaderMap, ApiResponse<AuthResponse>), ApiError> {
    let ip = caller_ip(&headers, Some(addr));

    if let Err(retry_after) = state.auth_rate_limiter.check(&ip) {
        return Err(ApiError::TooManyRequests(
            "Too many login attempts. Please try again later.".to_string(),
            Some(retry_after.as_secs()),
        ));
    }

    let identity = state
        .db
        .find_identity_by_email(&body.email)
        .await
        .map_err(|e| ApiError::Database(e, "Login failed"))?;

    // Always run verify_password — use the dummy hash when no identity was found.
    // This ensures response time is identical whether or not the email is registered,
    // preventing user enumeration via timing differences.
    let hash_to_check = identity
        .as_ref()
        .and_then(|id| id.password_hash.as_deref())
        .unwrap_or(state.dummy_hash.as_str());

    let password_ok = match verify_password(&body.password, hash_to_check) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Password verification error: {e}");
            return Err(ApiError::Internal("Login failed".to_string()));
        }
    };

    // Reject here — after the constant-time verify — so timing is uniform.
    let identity = match identity {
        Some(id) if password_ok => id,
        _ => {
            return Err(ApiError::Unauthorized(
                "Invalid email or password".to_string(),
            ));
        }
    };

    // Require verified email before granting access.
    if !identity.email_verified {
        return Err(ApiError::Unauthorized(
            "Please verify your email address before signing in.".to_string(),
        ));
    }

    // Identity confirmed to have a password (SSO-only accounts have None).
    if identity.password_hash.is_none() {
        return Err(ApiError::Unauthorized(
            "Invalid email or password".to_string(),
        ));
    }

    let role = state
        .db
        .find_user_role(identity.user_id)
        .await
        .map_err(|e| {
            tracing::error!("DB error resolving role: {e}");
            ApiError::Internal("Login failed".to_string())
        })?;

    let claims = make_claims(&identity.user_id.to_string(), &role);
    let access_token = sign_access_token(&claims, &state.jwt_secret).map_err(|e| {
        tracing::error!("JWT signing failed: {e}");
        ApiError::Internal("Login failed".to_string())
    })?;

    let refresh_token = Uuid::new_v4().to_string();

    state
        .db
        .store_refresh_token(identity.user_id, &refresh_token, refresh_token_expiry())
        .await
        .map_err(|e| ApiError::Database(e, "Login failed"))?;

    let secure = !is_local(Some(addr));
    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&access_cookie(&access_token, secure))
            .map_err(|_| ApiError::Internal("Cookie encoding failed".to_string()))?,
    );
    resp_headers.append(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&refresh_cookie(&refresh_token, secure))
            .map_err(|_| ApiError::Internal("Cookie encoding failed".to_string()))?,
    );

    Ok((
        resp_headers,
        ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("Login successful"),
            data: Some(AuthResponse {
                access_token,
                refresh_token,
                token_type: String::from("Bearer"),
                expires_in: ACCESS_TOKEN_EXPIRY_SECS,
            }),
        },
    ))
}

async fn refresh(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    jar: axum_extra::extract::CookieJar,
    body: Option<Json<RefreshRequest>>,
) -> Result<(HeaderMap, ApiResponse<AuthResponse>), ApiError> {
    // Accept refresh token from cookie first, then from request body (backwards compat).
    let rt = jar
        .get("refresh_token")
        .map(|c| c.value().to_owned())
        .or_else(|| body.map(|Json(b)| b.refresh_token))
        .ok_or_else(|| ApiError::Unauthorized("No refresh token provided".to_string()))?;

    let token_row = state
        .db
        .find_refresh_token(&rt)
        .await
        .map_err(|e| ApiError::Database(e, "Token refresh failed"))?
        .ok_or_else(|| ApiError::Unauthorized("Invalid or expired refresh token".to_string()))?;

    let role = state
        .db
        .find_user_role(token_row.user_id)
        .await
        .map_err(|e| {
            tracing::error!("DB error resolving role on refresh: {e}");
            ApiError::Internal("Token refresh failed".to_string())
        })?;

    let claims = make_claims(&token_row.user_id.to_string(), &role);
    let access_token = sign_access_token(&claims, &state.jwt_secret).map_err(|e| {
        tracing::error!("JWT signing failed: {e}");
        ApiError::Internal("Token refresh failed".to_string())
    })?;

    let secure = !is_local(Some(addr));
    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&access_cookie(&access_token, secure))
            .map_err(|_| ApiError::Internal("Cookie encoding failed".to_string()))?,
    );

    // Return the same refresh token (rotation happens only at logout / re-login).
    Ok((
        resp_headers,
        ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("Token refreshed"),
            data: Some(AuthResponse {
                access_token,
                refresh_token: String::from(rt),
                token_type: String::from("Bearer"),
                expires_in: ACCESS_TOKEN_EXPIRY_SECS,
            }),
        },
    ))
}

async fn resend_verification(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    ValidatedJson(body): ValidatedJson<ResendVerificationRequest>,
) -> Result<ApiResponse<ResendVerificationResponse>, ApiError> {
    let ip = caller_ip(&headers, Some(addr));
    if let Err(retry_after) = state.auth_rate_limiter.check(&ip) {
        return Err(ApiError::TooManyRequests(
            "Too many requests. Please try again later.".to_string(),
            Some(retry_after.as_secs()),
        ));
    }

    let result = state
        .db
        .resend_verification_token(&body.email)
        .await
        .map_err(|e| ApiError::Database(e, "Resend verification failed"))?;

    match result {
        Some((_, token)) => Ok(ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("Verification email sent."),
            data: Some(ResendVerificationResponse {
                verification_token: token.to_string(),
            }),
        }),
        None => Ok(ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from(
                "If this address is registered and unverified, a new email has been sent.",
            ),
            data: None,
        }),
    }
}

async fn forgot_password(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    ValidatedJson(body): ValidatedJson<ForgotPasswordRequest>,
) -> Result<ApiResponse<ForgotPasswordResponse>, ApiError> {
    let ip = caller_ip(&headers, Some(addr));
    if let Err(retry_after) = state.auth_rate_limiter.check(&ip) {
        return Err(ApiError::TooManyRequests(
            "Too many requests. Please try again later.".to_string(),
            Some(retry_after.as_secs()),
        ));
    }

    let result = state
        .db
        .create_password_reset_token(&body.email)
        .await
        .map_err(|e| ApiError::Database(e, "Forgot password failed"))?;

    match result {
        Some((_, token)) => Ok(ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("Password reset email sent."),
            data: Some(ForgotPasswordResponse {
                reset_token: token.to_string(),
            }),
        }),
        None => Ok(ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("If this address is registered, a reset link has been sent."),
            data: None,
        }),
    }
}

async fn reset_password(
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<ResetPasswordRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let token = Uuid::parse_str(&body.token)
        .map_err(|_| ApiError::BadRequest("Invalid reset token".to_string()))?;

    let new_hash = hash_password(&body.new_password).map_err(|e| {
        tracing::error!("Password hashing failed: {e}");
        ApiError::Internal("Password reset failed".to_string())
    })?;

    let updated = state
        .db
        .reset_password(token, &new_hash)
        .await
        .map_err(|e| ApiError::Database(e, "Password reset failed"))?;

    if !updated {
        return Err(ApiError::BadRequest(
            "This link has expired or has already been used.".to_string(),
        ));
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Password updated. You can now sign in."),
        data: None,
    })
}

async fn change_password(
    State(state): State<AppState>,
    AuthClaims(claims): AuthClaims,
    ValidatedJson(body): ValidatedJson<ChangePasswordRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;

    let identity = state
        .db
        .find_identity_by_user_id(user_id)
        .await
        .map_err(|e| ApiError::Database(e, "Change password failed"))?
        .ok_or_else(|| ApiError::NotFound("Account not found".to_string()))?;

    let current_hash = identity
        .password_hash
        .as_deref()
        .unwrap_or(state.dummy_hash.as_str());

    let password_ok = verify_password(&body.current_password, current_hash).map_err(|e| {
        tracing::error!("Password verification error: {e}");
        ApiError::Internal("Change password failed".to_string())
    })?;

    if !password_ok || identity.password_hash.is_none() {
        return Err(ApiError::Unauthorized(
            "Current password is incorrect".to_string(),
        ));
    }

    let new_hash = hash_password(&body.new_password).map_err(|e| {
        tracing::error!("Password hashing failed: {e}");
        ApiError::Internal("Change password failed".to_string())
    })?;

    state
        .db
        .update_password_hash(user_id, &new_hash)
        .await
        .map_err(|e| ApiError::Database(e, "Change password failed"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Password updated successfully"),
        data: None,
    })
}

async fn logout(
    State(state): State<AppState>,
    AuthClaims(claims): AuthClaims,
) -> Result<(HeaderMap, ApiResponse<()>), ApiError> {
    let user_id = parse_user_id(&claims.sub)?;

    state
        .db
        .revoke_all_user_tokens(user_id)
        .await
        .map_err(|e| ApiError::Database(e, "Logout failed"))?;

    let (clear_access, clear_refresh) = clear_cookies();
    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&clear_access)
            .map_err(|_| ApiError::Internal("Cookie encoding failed".to_string()))?,
    );
    resp_headers.append(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&clear_refresh)
            .map_err(|_| ApiError::Internal("Cookie encoding failed".to_string()))?,
    );

    Ok((
        resp_headers,
        ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("Logged out successfully"),
            data: None,
        },
    ))
}

async fn get_invite_info(
    State(state): State<AppState>,
    Query(q): Query<InviteTokenQuery>,
) -> Result<ApiResponse<InviteInfo>, ApiError> {
    let token = Uuid::parse_str(&q.token)
        .map_err(|_| ApiError::BadRequest("Invalid invite token".to_string()))?;

    let info = state
        .db
        .get_invite_info(token)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to fetch invite info"))?
        .ok_or_else(|| ApiError::NotFound("Invite not found or has expired".to_string()))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Invite info retrieved"),
        data: Some(info),
    })
}

async fn accept_invite(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<AcceptInviteRequest>,
) -> Result<(HeaderMap, ApiResponse<AcceptInviteResponse>), ApiError> {
    let token = Uuid::parse_str(&body.token)
        .map_err(|_| ApiError::BadRequest("Invalid invite token".to_string()))?;

    if body.password.len() < 10 {
        return Err(ApiError::BadRequest(
            "Password must be at least 10 characters.".to_string(),
        ));
    }

    let password_hash = hash_password(&body.password).map_err(|e| {
        tracing::error!("Password hashing failed: {e}");
        ApiError::Internal("Accept invite failed".to_string())
    })?;

    let user_id = state
        .db
        .accept_invite(token, &password_hash)
        .await
        .map_err(|e| ApiError::Database(e, "Accept invite failed"))?
        .ok_or_else(|| ApiError::BadRequest("Invite not found or has expired".to_string()))?;

    let role = state.db.find_user_role(user_id).await.map_err(|e| {
        tracing::error!("DB error resolving role after invite accept: {e}");
        ApiError::Internal("Accept invite failed".to_string())
    })?;

    let claims = make_claims(&user_id.to_string(), &role);
    let access_token = sign_access_token(&claims, &state.jwt_secret).map_err(|e| {
        tracing::error!("JWT signing failed: {e}");
        ApiError::Internal("Accept invite failed".to_string())
    })?;

    let refresh_token = Uuid::new_v4().to_string();
    state
        .db
        .store_refresh_token(user_id, &refresh_token, refresh_token_expiry())
        .await
        .map_err(|e| ApiError::Database(e, "Accept invite failed"))?;

    let secure = !is_local(Some(addr));
    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&access_cookie(&access_token, secure))
            .map_err(|_| ApiError::Internal("Cookie encoding failed".to_string()))?,
    );
    resp_headers.append(
        axum::http::header::SET_COOKIE,
        HeaderValue::from_str(&refresh_cookie(&refresh_token, secure))
            .map_err(|_| ApiError::Internal("Cookie encoding failed".to_string()))?,
    );

    Ok((
        resp_headers,
        ApiResponse {
            http_status: StatusCode::OK,
            status: true,
            message: String::from("Invite accepted. Welcome to Steward."),
            data: Some(AcceptInviteResponse {
                access_token,
                refresh_token,
                token_type: String::from("Bearer"),
                expires_in: ACCESS_TOKEN_EXPIRY_SECS,
            }),
        },
    ))
}
