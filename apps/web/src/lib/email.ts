import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM ?? "Steward <noreply@steward.app>";

export interface EmailVerificationParams {
  to: string;
  name: string;
  verificationUrl: string;
}

export interface WorkerInviteEmailParams {
  to: string;
  managerName: string;
  inviteUrl: string;
}

export interface PaymentNotificationEmailParams {
  to: string;
  workerName: string;
  amount: string;
  currency: string;
  payDate: string;
  managerName: string;
}

export async function sendWorkerInviteEmail(params: WorkerInviteEmailParams) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `${params.managerName} invited you to Steward`,
    html: workerInviteHtml(params),
  });
}

export async function sendEmailVerificationEmail(params: EmailVerificationParams) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Verify your Steward account",
    html: emailVerificationHtml(params),
  });
}

export interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Reset your Steward password",
    html: passwordResetHtml(params),
  });
}

export async function sendPaymentNotificationEmail(params: PaymentNotificationEmailParams) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Payment of ${params.amount} ${params.currency} recorded`,
    html: paymentNotificationHtml(params),
  });
}

// ── Templates ─────────────────────────────────────────────────────────────────

function workerInviteHtml({ managerName, inviteUrl }: WorkerInviteEmailParams) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You're invited to Steward</title></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f2;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #201e1d;">
        <tr><td style="padding:32px 36px;border-bottom:2px solid #201e1d;">
          <span style="font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#201e1d;">Steward</span>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#201e1d;">You've been invited</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#4a4746;line-height:1.6;">
            <strong>${managerName}</strong> has invited you to Steward to manage your payments and work details.
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:#4a4746;line-height:1.6;">
            Click the button below to create your account and accept the invite.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;padding:14px 28px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.03em;">Accept invite</a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:2px solid #e8e6e3;font-size:12px;color:#9c9590;">
          If you didn't expect this invite, you can safely ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function emailVerificationHtml({ name, verificationUrl }: EmailVerificationParams) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Verify your Steward account</title></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f2;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #201e1d;">
        <tr><td style="padding:32px 36px;border-bottom:2px solid #201e1d;">
          <span style="font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#201e1d;">Steward</span>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#201e1d;">Verify your email</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#4a4746;line-height:1.6;">
            Hi ${name}, thanks for creating a Steward account. Click the button below to verify your email address and activate your account.
          </p>
          <a href="${verificationUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;padding:14px 28px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.03em;">Verify email address</a>
          <p style="margin:28px 0 0;font-size:13px;color:#9c9590;line-height:1.6;">
            This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:2px solid #e8e6e3;font-size:12px;color:#9c9590;">
          Or copy this link: <span style="color:#201e1d;">${verificationUrl}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function passwordResetHtml({ name, resetUrl }: PasswordResetEmailParams) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset your Steward password</title></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f2;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #201e1d;">
        <tr><td style="padding:32px 36px;border-bottom:2px solid #201e1d;">
          <span style="font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#201e1d;">Steward</span>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#201e1d;">Reset your password</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#4a4746;line-height:1.6;">
            Hi ${name}, we received a request to reset the password for your Steward account. Click the button below to choose a new one.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#0f6f66;color:#fff;padding:14px 28px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.03em;">Reset password</a>
          <p style="margin:28px 0 0;font-size:13px;color:#9c9590;line-height:1.6;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will not change.
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:2px solid #e8e6e3;font-size:12px;color:#9c9590;">
          Or copy this link: <span style="color:#201e1d;">${resetUrl}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function paymentNotificationHtml({
  workerName,
  amount,
  currency,
  payDate,
  managerName,
}: PaymentNotificationEmailParams) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment recorded</title></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f2;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #201e1d;">
        <tr><td style="padding:32px 36px;border-bottom:2px solid #201e1d;">
          <span style="font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#201e1d;">Steward</span>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#201e1d;">Payment recorded</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#4a4746;line-height:1.6;">
            Hi ${workerName}, a payment has been recorded for you.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #e8e6e3;margin-bottom:28px;">
            <tr>
              <td style="padding:14px 16px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9c9590;border-bottom:1px solid #e8e6e3;">Amount</td>
              <td style="padding:14px 16px;font-size:22px;font-weight:800;color:#201e1d;text-align:right;border-bottom:1px solid #e8e6e3;">${currency} ${amount}</td>
            </tr>
            <tr>
              <td style="padding:14px 16px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9c9590;">Date</td>
              <td style="padding:14px 16px;font-size:15px;color:#201e1d;text-align:right;">${payDate}</td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#9c9590;">Recorded by ${managerName}</p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:2px solid #e8e6e3;font-size:12px;color:#9c9590;">
          You're receiving this because you have an active payment relationship on Steward.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
