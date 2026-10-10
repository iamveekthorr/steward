use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use dashmap::DashMap;

/// Simple sliding-window rate limiter keyed on an arbitrary string (e.g. an IP
/// address or email).
///
/// All state is in-process.  For multi-process deployments replace with a
/// Redis-backed equivalent; the interface is identical.
#[derive(Clone)]
pub struct RateLimiter {
    state: Arc<DashMap<String, Vec<Instant>>>,
    max_per_window: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_per_window: usize, window: Duration) -> Self {
        Self {
            state: Arc::new(DashMap::new()),
            max_per_window,
            window,
        }
    }

    /// Returns `Ok(())` when the key is allowed through.
    ///
    /// Returns `Err(retry_after)` when the key has exceeded `max_per_window`
    /// attempts in the sliding window.  `retry_after` is how long the caller
    /// must wait before their oldest recorded attempt leaves the window —
    /// suitable for a `Retry-After` response header.
    pub fn check(&self, key: &str) -> Result<(), Duration> {
        let now = Instant::now();
        let cutoff = now - self.window;

        let mut entry = self.state.entry(key.to_string()).or_default();
        entry.retain(|&t| t > cutoff);

        if entry.len() >= self.max_per_window {
            let retry_after = entry
                .first()
                .map(|&oldest| {
                    let expires_at = oldest + self.window;
                    if expires_at > now {
                        expires_at - now
                    } else {
                        Duration::from_secs(1)
                    }
                })
                .unwrap_or(self.window);
            return Err(retry_after);
        }

        entry.push(now);
        Ok(())
    }
}
