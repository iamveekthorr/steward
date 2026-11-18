/// Thin wrapper around the Resend HTTP API.
/// Only sends; does not store state. All errors are logged and treated as
/// non-fatal so the caller continues even when email delivery fails.
use serde_json::json;

pub async fn send(api_key: &str, to: &str, subject: &str, html: &str) {
    let client = reqwest::Client::new();
    let body = json!({
        "from": "Steward <noreply@steward.app>",
        "to": [to],
        "subject": subject,
        "html": html
    });

    match client
        .post("https://api.resend.com/emails")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            tracing::info!("Email sent to {to}: {subject}");
        }
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::error!("Resend returned {status} for {to}: {body}");
        }
        Err(e) => {
            tracing::error!("Email delivery error to {to}: {e}");
        }
    }
}

pub fn subscription_expiry_warning_html(
    manager_name: &str,
    manager_email: &str,
    expires_at: &str,
    lemfi_account: &str,
) -> String {
    format!(
        r#"<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#201e1d">
<h2 style="margin:0 0 16px;font-size:20px;font-weight:800;letter-spacing:-0.02em">Subscription expiring soon</h2>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">
  <strong>{manager_name}</strong> ({manager_email}) has a Steward subscription that expires on
  <strong>{expires_at}</strong>.
</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">
  They have a <strong>36-hour grace period</strong> after expiry. After that, their account will be
  automatically suspended until a new payment is received and you activate their subscription.
</p>
<p style="margin:0 0 8px;font-size:14px;color:#605d5d">Your LemFi account for receiving payment:</p>
<pre style="background:#f3f2f2;padding:14px 16px;font-size:13px;line-height:1.6;border-left:3px solid #0f6f66">{lemfi_account}</pre>
<p style="margin:16px 0 0;font-size:13px;color:#9b9797">
  Once payment is received, activate their subscription from the
  <a href="https://steward-web.victorokonkwo67.workers.dev/admin/subscriptions" style="color:#0f6f66">admin dashboard</a>.
</p>
</div>"#
    )
}
