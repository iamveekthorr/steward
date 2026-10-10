# Steward — Claude Code build prompt

Paste everything below the line into Claude Code, run from the root of the `manage-me` repo. Before you start, copy these into the repo:

- `design/` ← `Manage Me App.dc.html`, `Manage Me App v2 Subscription.dc.html`, `Manage Me Auth.dc.html`, `Manage Me States.dc.html` (open them in a browser; they are the visual spec)
- `design/brand/` ← everything in `steward-brand/` (logo SVGs)
- `docs/BRD.md` ← `Manage Me BRD.md`
- Replace `readme.md`, `CLAUDE.md`, `AGENTS.md`, `DESIGN_BRIEF.md` with the renamed copies in `steward-brand/repo-updates/`

---

You are building **Steward** (formerly Manage Me) to production: a payroll remittance tool where UK-based managers pay workers ("links") back home and keep proof of every payment. The backend skeleton exists (Rust, Axum, SQLx, Postgres). Your job is to ship Phase 1 end to end: every screen, every state, auth, and the infrastructure to go live.

## Read first, in this order

1. `CLAUDE.md` — architecture, repository pattern, domain decisions. These are binding.
2. `docs/BRD.md` — especially §2 (zero custody), §6 (UI impact) and §7 (phasing).
3. `readme.md` — domain glossary, user flows, screen inventory, status vocabulary.
4. `design/*.dc.html` — open in a browser. They are the visual and copy source of truth. Lift copy verbatim, including error and empty-state wording.
5. `src/` and `migrations/` — see what exists before adding anything.

Then write `docs/PLAN.md`: the phase list below, broken into tasks, with any conflicts you found between the docs and the code. Stop and wait for my go-ahead before writing application code.

## Non-negotiables

- **Phase 1 has no billing surface at all.** No card forms, plan picker, paywall, wallet, or "coming soon" billing screen. `design/Manage Me App v2 Subscription.dc.html` is Phase 2 reference only. Do not build it.
- **Zero custody.** Steward stores no card numbers, bank credentials or customer money. Payouts are recorded, not executed.
- **Payouts are immutable.** Corrections are new reversing entries. Payment configurations are versioned (`valid_from` / `valid_until`), never overwritten.
- **Due dates are derived** from `cycle_anchor_date` + interval. Never store a "next due date".
- **Money** is `BIGINT` minor units plus an ISO 4217 code. Display as `NGN 150,000`, never a symbol.
- **Audit log** on every write to links, payment configurations, payouts, managers and devices.
- **Mobile-first:** everything works at 375px. Hit targets are at least 44px.
- **Plain language.** The copy in the design files is final unless it contradicts the BRD.

## Stack decisions

- Server-rendered HTML: **Askama** templates + **HTMX** for partial updates. No SPA and no WASM in Phase 1.
- CSS: one hand-written stylesheet built from the design files' tokens (colours, type, spacing), with CSS custom properties. No Tailwind, no component library.
- Sessions: `tower-sessions` with a Postgres store. Cookies are HttpOnly, Secure and SameSite=Lax.
- Passwords: `argon2` (argon2id). CSRF tokens on every form. Rate-limit auth routes with `tower_governor`.
- Email: a `Mailer` trait with a Postmark (or Resend) implementation and a log-only dev implementation.
- File storage (proof of payment): a `BlobStore` trait with S3-compatible and local-disk implementations. Upload with presigned PUT, validate type (jpg, png, pdf) and size (≤10 MB), and serve through short-lived signed URLs only.
- Background jobs: a Tokio interval task for reminders and overdue flags. Make it idempotent with a `job_runs` table.
- Keep the existing JSON API under `/api/v1`. HTML routes live at the root and call the same repository layer.

## Brand

- Name: **Steward**. Replace every remaining "Manage Me" / `manage_me` / `manage-me` in code, config, container names, DB names and docs. List each rename in the PR description.
- Wordmark: `design/brand/steward-wordmark.svg` (teal flow-S plus "teward"). App icon and favicon: `steward-icon.svg`. Convert the wordmark's text to outlines before shipping, or inline it as SVG with the heading font loaded.

## Screens to build

Match the design files for layout, copy and states. Every list and detail screen has four states: loading (skeleton), empty, error and populated. `design/Manage Me States.dc.html` defines them.

**Auth** (`design/Manage Me Auth.dc.html`)

- Sign up, log in, log out
- Email verification (send, confirm, resend, expired link)
- Forgot password and reset password (single-use token, 1-hour expiry)
- Manager verification: pending state and business-details submission
- Invite accept: a worker follows the invite URL, creates an account or logs in, and the link becomes active. Cover expired, already-used and wrong-account cases.

**Manager** (`design/Manage Me App.dc.html`, role = manager)

- Dashboard: KPI tiles, upcoming payments (7/14/30 days), overdue list
- Links list with status filter
- Link detail: header with Home address and Work address (full street-level fields; remote work stays a text note), plus tabs for Overview, Payments, Overtime and History
- Add link / invite modal, including both address blocks
- Payment configuration form (versioned save)
- Record payout, with proof upload
- Overtime: policies, and records with approve/reject
- Devices: list, detail, assign/unassign, custody history
- Link transfer with worker consent
- Notification centre (the bell) and notification preferences
- Account settings

**Worker** (role = worker)

- Home: next payment is the most prominent element
- Payment history with proof download
- My details (the worker edits their own payout preference; the manager sees it read-only and masked)
- My device

**Shared**

- 404, 403, 500 and maintenance pages in the design language
- Terms, Privacy and Cookie pages (placeholder legal copy clearly marked `TODO: legal review`)

## Data work

- Migrations with `sqlx migrate` for anything the screens need that is missing: `home_address_*` and `work_address_*` columns on links (line1, line2, city, state_province, postcode, country), `remote_work_note`, sessions, email tokens, invites, notifications, `job_runs`, `audit_log`, blobs.
- Leave Phase 2 tables (`subscriptions`, `wallets`, `payout_mandates`, `payout_recipients`, `provider_events`) out of Phase 1 migrations.
- Seed script (`cargo run --bin seed`) that reproduces the demo data in the design files, so screens can be compared side by side.

## Phases (one PR each; stop for review after each)

1. **Foundation**: rename, layout shell, stylesheet from tokens, Askama + HTMX wiring, error pages, CI (fmt, clippy `-D warnings`, test, `sqlx prepare --check`).
2. **Auth**: all auth screens and flows, sessions, CSRF, rate limits, mailer, role-based route guards (manager, worker, unverified).
3. **Manager core**: dashboard, links, link detail, add link/invite, payment configuration, record payout plus proof upload.
4. **Worker**: home, history, my details, device.
5. **Secondary**: overtime, devices, transfers, notifications, reminder job, settings.
6. **States pass**: every screen's loading, empty and error states checked against `design/Manage Me States.dc.html`, plus the 375px pass.
7. **Go-live**: see the checklist below.

After each phase, give me: what shipped, screenshots at 1280px and 375px of every new screen, anything that deviates from the design, and open questions.

## Tests

- Unit tests for due-date derivation (month-end anchors, leap years, 29/30/31 anchors), money formatting and config versioning.
- Integration tests with `sqlx::test` for every repository method and every auth flow, including the failure paths.
- An HTTP test per route covering the auth guard (anonymous, wrong role, correct role).
- A Playwright smoke suite covering: sign up → verify → add link → worker accepts → configure payment → record payout with proof → worker sees it.

## Go-live checklist (Phase 7)

- Multi-stage Dockerfile producing a small runtime image with a non-root user; `/healthz` and `/readyz` endpoints.
- Deploy target: Fly.io or Railway (UK/EU region), with managed Postgres, daily backups and point-in-time recovery, and a tested restore.
- Config: all secrets from env; `.env.example` documented; startup fails fast on missing config.
- Security: HTTPS only, HSTS, CSP (no inline scripts except HTMX), secure headers, a dependency audit (`cargo audit`) in CI, and uploads scanned or restricted by type.
- Observability: structured JSON logs, request IDs, error tracking (Sentry), uptime check.
- Email: SPF, DKIM and DMARC on the sending domain; transactional templates for verification, reset, invite, reminder, overdue and payout recorded.
- GDPR (UK): data export and account deletion (soft-delete with a retention window; payouts and audit rows are kept, as legally required), cookie notice, and a privacy page listing processors.
- Migrations run on deploy; rollback plan written in `docs/RUNBOOK.md`, along with on-call basics and how to rotate secrets.
- Staging environment matching production, with seed data.

## How to work

- Keep to the patterns in `CLAUDE.md`: repository traits, `ApiResponse<T>`, and one router module per resource.
- Small commits. Run `cargo fmt`, `cargo clippy` and `cargo test` before every commit.
- If the design files and the BRD disagree, the BRD wins on behaviour and the design wins on look and copy. Log each conflict in `docs/PLAN.md`.
- Ask before adding a dependency not listed here, or before building anything outside Phase 1.
