//! In-memory [`ObjectStore`] for unit and integration tests.
//!
//! No network calls or real credentials required.  The presigned URL is
//! deterministic so tests can assert on its contents:
//!
//! ```
//! # use steward::storage::mock::InMemoryStore;
//! # use steward::storage::ObjectStore;
//! # tokio_test::block_on(async {
//! let store = InMemoryStore::new("https://cdn.test");
//! let url = store.presign_put("uploads/foo.pdf", "application/pdf", 300).await.unwrap();
//! assert!(url.starts_with("https://put.mock/uploads/foo.pdf"));
//! # });
//! ```

use std::sync::{Arc, Mutex};

use super::store::{ObjectStore, StorageError};

/// An in-memory store that records deleted keys for test assertions.
#[derive(Clone, Default)]
#[allow(dead_code)]
pub struct InMemoryStore {
    pub_base: String,
    deleted: Arc<Mutex<Vec<String>>>,
}

#[allow(dead_code)]
impl InMemoryStore {
    pub fn new(pub_base: impl Into<String>) -> Self {
        Self {
            pub_base: pub_base.into(),
            deleted: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Keys passed to `delete()` since construction.
    pub fn deleted_keys(&self) -> Vec<String> {
        self.deleted.lock().unwrap().clone()
    }
}

#[async_trait::async_trait]
impl ObjectStore for InMemoryStore {
    async fn presign_put(
        &self,
        key: &str,
        _content_type: &str,
        _expires_secs: u64,
    ) -> Result<String, StorageError> {
        // Deterministic URL — tests assert on this format.
        Ok(format!("https://put.mock/{key}?sig=testtoken"))
    }

    fn public_url(&self, key: &str) -> String {
        format!("{}/{key}", self.pub_base.trim_end_matches('/'))
    }

    async fn delete(&self, key: &str) -> Result<(), StorageError> {
        self.deleted.lock().unwrap().push(key.to_owned());
        Ok(())
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn presign_returns_deterministic_url() {
        let store = InMemoryStore::new("https://cdn.test");
        let url = store
            .presign_put("uploads/abc.pdf", "application/pdf", 300)
            .await
            .unwrap();
        assert!(url.starts_with("https://put.mock/uploads/abc.pdf"));
        assert!(url.contains("sig=testtoken"));
    }

    #[tokio::test]
    async fn public_url_appends_key() {
        let store = InMemoryStore::new("https://cdn.test");
        assert_eq!(
            store.public_url("uploads/foo.pdf"),
            "https://cdn.test/uploads/foo.pdf"
        );
    }

    #[tokio::test]
    async fn public_url_strips_trailing_slash_from_base() {
        let store = InMemoryStore::new("https://cdn.test/");
        assert_eq!(
            store.public_url("uploads/foo.pdf"),
            "https://cdn.test/uploads/foo.pdf"
        );
    }

    #[tokio::test]
    async fn delete_tracks_keys() {
        let store = InMemoryStore::new("https://cdn.test");
        store.delete("uploads/abc.pdf").await.unwrap();
        store.delete("uploads/xyz.png").await.unwrap();
        assert_eq!(
            store.deleted_keys(),
            vec!["uploads/abc.pdf", "uploads/xyz.png"]
        );
    }

    #[tokio::test]
    async fn delete_is_idempotent() {
        let store = InMemoryStore::new("https://cdn.test");
        store.delete("uploads/x.pdf").await.unwrap();
        store.delete("uploads/x.pdf").await.unwrap();
        assert_eq!(store.deleted_keys().len(), 2); // recorded twice, no error
    }
}
