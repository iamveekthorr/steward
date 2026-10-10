use axum::{
    Json,
    extract::{FromRequest, Request},
};
use serde::de::DeserializeOwned;
use validator::Validate;

use crate::errors::ApiError;

/// Drop-in replacement for `Json<T>` that validates the deserialized body
/// using the `Validate` derive macro before the handler runs.
///
/// Usage: replace `Json(body): Json<T>` with `ValidatedJson(body): ValidatedJson<T>`
/// and add `#[derive(Validate)]` with field annotations to `T`.
pub struct ValidatedJson<T>(pub T);

impl<T, S> FromRequest<S> for ValidatedJson<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state)
            .await
            .map_err(|e| ApiError::BadRequest(e.body_text()))?;

        value
            .validate()
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        Ok(ValidatedJson(value))
    }
}
