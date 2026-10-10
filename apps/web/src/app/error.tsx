"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="err-page">
      <p className="err-kicker">Something went wrong</p>
      <h1 className="err-heading">We hit an unexpected error</h1>
      <p className="err-body">
        The connection dropped while loading this page. Nothing has changed — no payment was
        recorded or missed.
      </p>
      {error.digest && (
        <p className="err-digest">Reference {error.digest}</p>
      )}
      <div className="err-actions">
        <button type="button" onClick={reset} className="err-btn-primary">
          Try again
        </button>
        <a href="mailto:support@manageme.app" className="err-btn-outline">
          Contact support
        </a>
      </div>
    </div>
  );
}
