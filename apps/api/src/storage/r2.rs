//! Cloudflare R2 implementation of [`ObjectStore`].
//!
//! R2 exposes an S3-compatible API, so the standard `aws-sdk-s3` crate works
//! without modification — we only override the endpoint URL.
//!
//! # Required environment variables
//! | Variable | Description |
//! |---|---|
//! | `S3_API_URL` | R2 S3-compatible endpoint, e.g. `https://<account_id>.r2.cloudflarestorage.com` |
//! | `R2_ACCESS_KEY_ID` | R2 API token key ID |
//! | `R2_SECRET_ACCESS_KEY` | R2 API token secret |
//! | `R2_BUCKET` | Bucket name |
//! | `R2_PUBLIC_URL` | Public base URL for served objects, e.g. `https://cdn.example.com` |
//!
//! # Presigned URL lifetime
//! PUT presigned URLs are valid for [`PRESIGN_TTL_SECS`] seconds (set in
//! `routes/uploads.rs`).  Only the intended content-type is accepted; clients
//! must send the matching `Content-Type` header when uploading or R2 will
//! reject the request.

use std::time::Duration;

use aws_credential_types::Credentials;
use aws_sdk_s3::{Client, config::Region, presigning::PresigningConfig};

use super::store::{ObjectStore, StorageError};

/// Cloudflare R2-backed object store.
///
/// Cheap to clone — the inner SDK client is `Arc`-wrapped.
#[derive(Clone)]
pub struct R2Client {
    client: Client,
    bucket: String,
    public_url: String,
}

impl R2Client {
    /// Construct a client from explicit credentials.
    ///
    /// `s3_api_url` is the full R2 S3-compatible endpoint URL from the
    /// Cloudflare dashboard (e.g. `https://<account_id>.r2.cloudflarestorage.com`).
    pub fn new(
        s3_api_url: &str,
        access_key_id: &str,
        secret_access_key: &str,
        bucket: impl Into<String>,
        public_url: impl Into<String>,
    ) -> Self {
        let creds = Credentials::new(
            access_key_id,
            secret_access_key,
            None, // session token — not used by R2
            None, // credential expiry — managed outside the SDK
            "r2",
        );

        // R2 uses the S3 API; set `auto` as the region (Cloudflare ignores it
        // but the SDK requires a non-empty value).
        let config = aws_sdk_s3::Config::builder()
            .credentials_provider(creds)
            .region(Region::new("auto"))
            .endpoint_url(s3_api_url)
            // R2 uses virtual-hosted-style URLs; path-style is not recommended.
            .force_path_style(false)
            .build();

        Self {
            client: Client::from_conf(config),
            bucket: bucket.into(),
            public_url: public_url.into(),
        }
    }
}

#[async_trait::async_trait]
impl ObjectStore for R2Client {
    async fn presign_put(
        &self,
        key: &str,
        content_type: &str,
        expires_secs: u64,
    ) -> Result<String, StorageError> {
        let presigning_cfg = match PresigningConfig::expires_in(Duration::from_secs(expires_secs)) {
            Ok(data) => data,
            Err(e) => return Err(StorageError::Config(e.to_string())),
        };

        let presigned = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type(content_type)
            .presigned(presigning_cfg)
            .await
            .map_err(|e| StorageError::Sdk(e.to_string()))?;

        Ok(presigned.uri().to_string())
    }

    fn public_url(&self, key: &str) -> String {
        format!("{}/{key}", self.public_url.trim_end_matches('/'))
    }

    async fn delete(&self, key: &str) -> Result<(), StorageError> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| StorageError::Sdk(e.to_string()))?;
        Ok(())
    }
}
