//! Core object-storage trait and error type.
//!
//! `ObjectStore` is the single interface all backends must implement.
//! The production backend is [`crate::storage::r2::R2Client`]; the test
//! backend is [`crate::storage::mock::InMemoryStore`].
//!
//! # Upload flow
//! ```text
//! Browser                      API                         R2
//!   │  POST /uploads/presign    │                            │
//!   │ ────────────────────────► │                            │
//!   │                           │  presign PUT (aws-sdk-s3)  │
//!   │                           │ ──────────────────────────►│
//!   │  { upload_url, key }      │                            │
//!   │ ◄──────────────────────── │                            │
//!   │                           │                            │
//!   │  PUT <upload_url>  (file) │                            │
//!   │ ──────────────────────────────────────────────────────►│
//!   │                           │                            │
//!   │  POST /manager/payouts    │                            │
//!   │    { ..., proof_key }     │                            │
//!   │ ────────────────────────► │                            │
//!   │                           │  store public_url(key)     │
//!   │  { id }                   │                            │
//!   │ ◄──────────────────────── │                            │
//! ```
//!
//! File data never travels through this API server.

use std::fmt;

/// Errors returned by any [`ObjectStore`] implementation.
#[derive(Debug)]
pub enum StorageError {
    /// The underlying SDK or transport returned an error.
    Sdk(String),
    /// A required configuration value was missing or invalid.
    Config(String),
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StorageError::Sdk(msg) => write!(f, "storage SDK error: {msg}"),
            StorageError::Config(msg) => write!(f, "storage config error: {msg}"),
        }
    }
}

impl std::error::Error for StorageError {}

/// Core interface for every object-store backend.
///
/// Implementations are expected to be cheap to clone (backed by `Arc` internally).
#[async_trait::async_trait]
pub trait ObjectStore: Send + Sync {
    /// Generate a presigned HTTP `PUT` URL valid for `expires_secs` seconds.
    ///
    /// The caller uploads the file directly to the returned URL; no binary
    /// data travels through this API server.  After a successful upload the
    /// caller commits the `key` (returned by the presign endpoint alongside
    /// the URL) back to the database record.
    async fn presign_put(
        &self,
        key: &str,
        content_type: &str,
        expires_secs: u64,
    ) -> Result<String, StorageError>;

    /// Return the public-facing URL for an already-uploaded object.
    fn public_url(&self, key: &str) -> String;

    /// Delete an object by key.  Used to clean up orphaned uploads.
    #[allow(dead_code)]
    async fn delete(&self, key: &str) -> Result<(), StorageError>;
}
