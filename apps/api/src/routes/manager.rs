use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    app::{AppState, PostgresDbPool},
    authentication::jwt::ManagerClaims,
    enums::link_status::LinkStatus,
    errors::{ApiError, parse_user_id},
    models::{auth::AuthRepository, links::Links},
    routes::auth::LINK_FREE_QUOTA,
    utils::response::ApiResponse,
};

// ── Invite response ───────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct CreateLinkResponse {
    #[serde(flatten)]
    pub link: LinkSummary,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invite_token: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/manager/links", get(list_links))
        .route("/manager/links", post(create_link))
        .route("/manager/links/{id}", get(get_link_detail))
        .route("/manager/links/{id}/status", patch(update_link_status))
        .route("/manager/quota", get(get_quota_status))
        .route("/manager/dashboard", get(dashboard_summary))
        .route("/manager/dashboard/kpis", get(dashboard_kpis))
        .route("/manager/dashboard/charts", get(dashboard_charts))
        .route("/manager/payouts", post(record_payout_handler))
        .route("/manager/devices", get(list_devices_handler))
        .route("/manager/devices", post(create_device_handler))
        .route("/manager/routers", get(list_routers_handler))
        .route("/manager/routers", post(create_router_handler))
        .route("/manager/routers/{id}", get(get_router_handler))
        .route("/manager/routers/{id}", patch(update_router_handler))
        .route("/manager/routers/{id}/assign", patch(assign_router_handler))
        .route("/manager/overtime", get(list_overtime_handler))
        .route("/manager/overtime", post(create_overtime_handler))
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct LinkSummary {
    pub id: Uuid,
    pub worker_name: String,
    pub worker_email: String,
    pub job_type: String,
    pub pay_schedule: Option<String>,
    pub base_amount: Option<i64>,
    pub currency: Option<String>,
    pub status: LinkStatus,
    pub next_due_date: Option<DateTime<Utc>>,
    pub last_paid_date: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct LinkPayoutRow {
    pub id: Uuid,
    pub period_label: String,
    pub base_amount: i64,
    pub overtime_amount: Option<i64>,
    pub bonus_amount: Option<i64>,
    pub total_amount: i64,
    pub currency: String,
    pub status: String,
    pub paid_at: Option<DateTime<Utc>>,
    pub proof_of_payment: Option<String>,
}

#[derive(Serialize)]
pub struct LinkDetail {
    pub id: Uuid,
    pub worker_name: String,
    pub job_type: String,
    pub status: LinkStatus,
    pub start_date: DateTime<Utc>,
    pub home_country: String,
    pub home_city: Option<String>,
    pub work_country: String,
    pub work_city: Option<String>,
    pub pay_schedule: Option<String>,
    pub base_amount: Option<i64>,
    pub currency: Option<String>,
    pub next_due_date: Option<DateTime<Utc>>,
    pub last_paid_date: Option<DateTime<Utc>>,
    pub payouts: Vec<LinkPayoutRow>,
}

#[derive(Serialize)]
pub struct MonthlyTrend {
    pub month: String,
    pub total: i64,
}

#[derive(Serialize)]
pub struct PaymentStatusBreakdown {
    pub on_schedule: i64,
    pub overdue: i64,
    pub pending_invite: i64,
    pub inactive: i64,
}

#[derive(Serialize)]
pub struct CurrencyTotal {
    pub currency: String,
    pub total: i64,
}

#[derive(Serialize)]
pub struct OverdueWorker {
    pub name: String,
    pub days_overdue: i64,
}

#[derive(Serialize)]
pub struct AttentionItem {
    pub link_id: Uuid,
    pub worker_name: String,
    pub due_date: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
}

#[derive(Serialize)]
pub struct PunctualityMonth {
    pub month: String,
    pub on_time: i64,
    pub late: i64,
}

#[derive(Serialize)]
pub struct LinkYtdPayout {
    pub link_id: Uuid,
    pub worker_name: String,
    pub total_ytd: i64,
    pub currency: String,
}

#[derive(Serialize)]
pub struct AutomationStats {
    pub configured: i64,
    pub not_configured: i64,
    pub active_total: i64,
}

#[derive(Serialize)]
pub struct DashboardSummary {
    pub active_links: i64,
    pub due_this_week: i64,
    pub due_this_week_amounts: Vec<CurrencyTotal>,
    pub overdue: i64,
    pub overdue_worker: Option<OverdueWorker>,
    pub paid_this_month: i64,
    pub paid_this_month_payouts: i64,
    pub monthly_trend: Vec<MonthlyTrend>,
    pub status_breakdown: PaymentStatusBreakdown,
    pub currency_totals: Vec<CurrencyTotal>,
    pub needs_attention: Vec<AttentionItem>,
    pub on_time_rate: f64,
    pub total_payouts_12mo: i64,
    pub avg_delay_days: f64,
    pub monthly_punctuality: Vec<PunctualityMonth>,
    pub paid_by_link: Vec<LinkYtdPayout>,
    pub automation: AutomationStats,
}

/// Fast KPI tiles — 4 COUNT queries run in parallel.
#[derive(Serialize)]
pub struct DashboardKpisResponse {
    pub active_links: i64,
    pub total_links: i64,
    pub pending_links: i64,
    pub overdue_links: i64,
    pub due_this_week: i64,
    pub due_this_week_amounts: Vec<CurrencyTotal>,
    pub paid_this_month: i64,
    pub paid_this_month_payouts: i64,
    pub overdue_worker: Option<OverdueWorker>,
}

/// Heavy chart / table data — run in parallel after KPIs are served.
#[derive(Serialize)]
pub struct DashboardChartsResponse {
    pub monthly_trend: Vec<MonthlyTrend>,
    pub status_breakdown: PaymentStatusBreakdown,
    pub currency_totals: Vec<CurrencyTotal>,
    pub needs_attention: Vec<AttentionItem>,
    pub on_time_rate: f64,
    pub total_payouts_12mo: i64,
    pub avg_delay_days: f64,
    pub monthly_punctuality: Vec<PunctualityMonth>,
    pub paid_by_link: Vec<LinkYtdPayout>,
    pub automation: AutomationStats,
}

#[derive(Serialize)]
pub struct LinkQuotaStatus {
    pub link_count: i64,
    pub quota_approved: bool,
    pub can_add_links: bool,
}

#[derive(Deserialize)]
pub struct CreateLinkRequest {
    pub worker_email: String,
    pub job_type: String,
    pub start_date: DateTime<Utc>,
    pub home_country: String,
    pub work_country: String,
    pub home_city: Option<String>,
    pub work_city: Option<String>,
}

#[derive(Deserialize)]
pub struct RecordPayoutRequest {
    pub link_id: Uuid,
    pub base_amount: i64,
    pub currency: String,
    pub paid_at: DateTime<Utc>,
    pub notes: Option<String>,
    /// R2 object key returned by `POST /uploads/presign`.  The API resolves
    /// this to a full public URL before storing.
    pub proof_key: Option<String>,
}

#[derive(Serialize)]
pub struct CreatedPayout {
    pub id: Uuid,
}

// ── Repository trait ──────────────────────────────────────────────────────────

pub trait ManagerRepository {
    fn find_manager_id_for_user(
        &self,
        user_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, sqlx::Error>> + Send;

    fn get_links_quota_status(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<(i64, bool), sqlx::Error>> + Send;

    fn create_link_for_manager(
        &self,
        manager_id: Uuid,
        worker_user_id: Uuid,
        job_type: &str,
        start_date: DateTime<Utc>,
        home_country: &str,
        work_country: &str,
        home_city: Option<&str>,
        work_city: Option<&str>,
    ) -> impl std::future::Future<Output = Result<Links, sqlx::Error>> + Send;

    fn get_full_dashboard(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<DashboardSummary, sqlx::Error>> + Send;

    fn get_dashboard_kpis(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<DashboardKpisResponse, sqlx::Error>> + Send;

    fn get_dashboard_charts(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<DashboardChartsResponse, sqlx::Error>> + Send;

    fn record_payout(
        &self,
        manager_id: Uuid,
        link_id: Uuid,
        base_amount: i64,
        currency: &str,
        paid_at: DateTime<Utc>,
        notes: Option<&str>,
        proof_of_payment: Option<&str>,
    ) -> impl std::future::Future<Output = Result<Uuid, sqlx::Error>> + Send;
}

impl ManagerRepository for PostgresDbPool {
    async fn find_manager_id_for_user(
        &self,
        user_id: Uuid,
    ) -> Result<Option<Uuid>, sqlx::Error> {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM managers WHERE user_id = $1 LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
    }

    async fn get_links_quota_status(
        &self,
        manager_id: Uuid,
    ) -> Result<(i64, bool), sqlx::Error> {
        let row = sqlx::query_as::<_, (i64, bool)>(
            r#"SELECT
                 (SELECT COUNT(*) FROM links WHERE manager_id = $1 AND status != 'terminated'),
                 m.links_quota_approved
               FROM managers m
               WHERE m.id = $1"#,
        )
        .bind(manager_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    async fn create_link_for_manager(
        &self,
        manager_id: Uuid,
        worker_user_id: Uuid,
        job_type: &str,
        start_date: DateTime<Utc>,
        home_country: &str,
        work_country: &str,
        home_city: Option<&str>,
        work_city: Option<&str>,
    ) -> Result<Links, sqlx::Error> {
        sqlx::query_as::<_, Links>(
            r#"INSERT INTO links
                 (manager_id, user_id, job_type, start_date,
                  home_country, home_city,
                  work_country, work_city)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *"#,
        )
        .bind(manager_id)
        .bind(worker_user_id)
        .bind(job_type)
        .bind(start_date)
        .bind(home_country)
        .bind(home_city)
        .bind(work_country)
        .bind(work_city)
        .fetch_one(&self.pool)
        .await
    }

    async fn get_full_dashboard(
        &self,
        manager_id: Uuid,
    ) -> Result<DashboardSummary, sqlx::Error> {
        let active_links = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM links WHERE manager_id = $1 AND status = 'active'",
        )
        .bind(manager_id)
        .fetch_one(&self.pool)
        .await?;

        let due_this_week = sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*)
               FROM payment_configurations pc
               JOIN links l ON l.id = pc.link_id
               WHERE l.manager_id = $1
                 AND l.status = 'active'
                 AND pc.valid_until IS NULL
                 AND pc.next_due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'"#,
        )
        .bind(manager_id)
        .fetch_one(&self.pool)
        .await?;

        let due_this_week_amounts = sqlx::query_as::<_, (String, i64)>(
            r#"SELECT pc.currency, COALESCE(SUM(pc.base_amount), 0)::BIGINT
               FROM payment_configurations pc
               JOIN links l ON l.id = pc.link_id
               WHERE l.manager_id = $1
                 AND l.status = 'active'
                 AND pc.valid_until IS NULL
                 AND pc.next_due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
               GROUP BY pc.currency
               ORDER BY SUM(pc.base_amount) DESC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(currency, total)| CurrencyTotal { currency, total })
        .collect();

        let overdue = sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*)
               FROM payment_configurations pc
               JOIN links l ON l.id = pc.link_id
               WHERE l.manager_id = $1
                 AND l.status = 'active'
                 AND pc.valid_until IS NULL
                 AND pc.next_due_date < NOW()"#,
        )
        .bind(manager_id)
        .fetch_one(&self.pool)
        .await?;

        let overdue_worker = if overdue > 0 {
            sqlx::query_as::<_, (String, i64)>(
                r#"SELECT
                     u.first_name || ' ' || u.last_name,
                     GREATEST(EXTRACT(DAY FROM NOW() - pc.next_due_date)::BIGINT, 1)
                   FROM payment_configurations pc
                   JOIN links l ON l.id = pc.link_id
                   JOIN users u ON u.id = l.user_id
                   WHERE l.manager_id = $1
                     AND l.status = 'active'
                     AND pc.valid_until IS NULL
                     AND pc.next_due_date < NOW()
                   ORDER BY pc.next_due_date ASC
                   LIMIT 1"#,
            )
            .bind(manager_id)
            .fetch_optional(&self.pool)
            .await?
            .map(|(name, days)| OverdueWorker { name, days_overdue: days })
        } else {
            None
        };

        let (paid_this_month, paid_this_month_payouts) = sqlx::query_as::<_, (i64, i64)>(
            r#"SELECT COALESCE(SUM(total_amount), 0)::BIGINT, COUNT(*)::BIGINT
               FROM payouts
               WHERE paid_by = $1
                 AND paid_at >= DATE_TRUNC('month', NOW())"#,
        )
        .bind(manager_id)
        .fetch_one(&self.pool)
        .await?;

        let monthly_trend = sqlx::query_as::<_, (String, i64)>(
            r#"SELECT
                 TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon') AS month_label,
                 COALESCE(SUM(total_amount), 0)::BIGINT AS total
               FROM payouts
               WHERE paid_by = $1
                 AND paid_at >= NOW() - INTERVAL '12 months'
               GROUP BY DATE_TRUNC('month', paid_at)
               ORDER BY DATE_TRUNC('month', paid_at) ASC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(month, total)| MonthlyTrend { month, total })
        .collect();

        let status_row = sqlx::query_as::<_, (i64, i64, i64, i64)>(
            r#"SELECT
                 COUNT(*) FILTER (WHERE l.status = 'active' AND (pc.next_due_date IS NULL OR pc.next_due_date >= NOW())) AS on_schedule,
                 COUNT(*) FILTER (WHERE l.status = 'active' AND pc.next_due_date < NOW()) AS overdue,
                 COUNT(*) FILTER (WHERE l.status = 'pending') AS pending_invite,
                 COUNT(*) FILTER (WHERE l.status IN ('inactive', 'terminated', 'suspended')) AS inactive
               FROM links l
               LEFT JOIN payment_configurations pc ON pc.link_id = l.id AND pc.valid_until IS NULL
               WHERE l.manager_id = $1"#,
        )
        .bind(manager_id)
        .fetch_one(&self.pool)
        .await?;

        let status_breakdown = PaymentStatusBreakdown {
            on_schedule: status_row.0,
            overdue: status_row.1,
            pending_invite: status_row.2,
            inactive: status_row.3,
        };

        let currency_totals = sqlx::query_as::<_, (String, i64)>(
            r#"SELECT currency, COALESCE(SUM(total_amount), 0)::BIGINT AS total
               FROM payouts
               WHERE paid_by = $1
                 AND paid_at >= DATE_TRUNC('year', NOW())
               GROUP BY currency
               ORDER BY total DESC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(currency, total)| CurrencyTotal { currency, total })
        .collect();

        let needs_attention = sqlx::query_as::<_, (Uuid, String, String, i64, String, String)>(
            r#"SELECT
                 l.id,
                 u.first_name || ' ' || u.last_name AS worker_name,
                 TO_CHAR(pc.next_due_date AT TIME ZONE 'UTC', 'DD Mon') AS due_date,
                 pc.base_amount,
                 pc.currency,
                 CASE
                   WHEN pc.next_due_date < NOW() THEN 'Overdue'
                   WHEN pc.next_due_date < NOW() + INTERVAL '7 days' THEN 'Due soon'
                   ELSE 'Active'
                 END AS status
               FROM links l
               JOIN payment_configurations pc ON pc.link_id = l.id AND pc.valid_until IS NULL
               JOIN users u ON u.id = l.user_id
               WHERE l.manager_id = $1
                 AND l.status = 'active'
                 AND pc.next_due_date <= NOW() + INTERVAL '7 days'
               ORDER BY pc.next_due_date ASC
               LIMIT 8"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(link_id, worker_name, due_date, amount, currency, status)| AttentionItem {
            link_id,
            worker_name,
            due_date,
            amount,
            currency,
            status,
        })
        .collect();

        let (on_time_count, total_payouts_12mo, avg_delay_secs): (i64, i64, Option<f64>) =
            sqlx::query_as::<_, (i64, i64, Option<f64>)>(
                r#"SELECT
                     COUNT(*) FILTER (WHERE paid_at <= period_end)::BIGINT AS on_time,
                     COUNT(*)::BIGINT AS total,
                     AVG(GREATEST(0.0, EXTRACT(EPOCH FROM (paid_at - period_end))))
                         FILTER (WHERE paid_at > period_end) AS avg_delay_secs
                   FROM payouts
                   WHERE paid_by = $1
                     AND paid_at >= NOW() - INTERVAL '12 months'"#,
            )
            .bind(manager_id)
            .fetch_one(&self.pool)
            .await?;

        let on_time_rate = if total_payouts_12mo > 0 {
            (on_time_count as f64 / total_payouts_12mo as f64) * 100.0
        } else {
            0.0
        };
        let avg_delay_days = avg_delay_secs.unwrap_or(0.0) / 86400.0;

        let monthly_punctuality = sqlx::query_as::<_, (String, i64, i64)>(
            r#"SELECT
                 TO_CHAR(DATE_TRUNC('month', period_end), 'Mon') AS month,
                 COUNT(*) FILTER (WHERE paid_at <= period_end)::BIGINT AS on_time,
                 COUNT(*) FILTER (WHERE paid_at > period_end)::BIGINT AS late
               FROM payouts
               WHERE paid_by = $1
                 AND paid_at >= NOW() - INTERVAL '12 months'
               GROUP BY DATE_TRUNC('month', period_end),
                        TO_CHAR(DATE_TRUNC('month', period_end), 'Mon')
               ORDER BY DATE_TRUNC('month', period_end) ASC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(month, on_time, late)| PunctualityMonth { month, on_time, late })
        .collect();

        let paid_by_link = sqlx::query_as::<_, (Uuid, String, i64, String)>(
            r#"SELECT
                 p.link_id,
                 u.first_name || ' ' || u.last_name AS worker_name,
                 SUM(p.total_amount)::BIGINT AS total_ytd,
                 MAX(p.currency) AS currency
               FROM payouts p
               JOIN links l ON l.id = p.link_id
               JOIN users u ON u.id = l.user_id
               WHERE p.paid_by = $1
                 AND p.paid_at >= DATE_TRUNC('year', NOW())
               GROUP BY p.link_id, u.first_name, u.last_name
               ORDER BY total_ytd DESC
               LIMIT 10"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(link_id, worker_name, total_ytd, currency)| LinkYtdPayout {
            link_id,
            worker_name,
            total_ytd,
            currency,
        })
        .collect();

        let (configured, not_configured, active_total): (i64, i64, i64) =
            sqlx::query_as::<_, (i64, i64, i64)>(
                r#"SELECT
                     COUNT(*) FILTER (WHERE EXISTS (
                         SELECT 1 FROM payment_configurations pc
                         WHERE pc.link_id = l.id AND pc.valid_until IS NULL
                     ))::BIGINT AS configured,
                     COUNT(*) FILTER (WHERE NOT EXISTS (
                         SELECT 1 FROM payment_configurations pc
                         WHERE pc.link_id = l.id AND pc.valid_until IS NULL
                     ))::BIGINT AS not_configured,
                     COUNT(*)::BIGINT AS active_total
                   FROM links l
                   WHERE l.manager_id = $1 AND l.status = 'active'"#,
            )
            .bind(manager_id)
            .fetch_one(&self.pool)
            .await?;

        let automation = AutomationStats { configured, not_configured, active_total };

        Ok(DashboardSummary {
            active_links,
            due_this_week,
            due_this_week_amounts,
            overdue,
            overdue_worker,
            paid_this_month,
            paid_this_month_payouts,
            monthly_trend,
            status_breakdown,
            currency_totals,
            needs_attention,
            on_time_rate,
            total_payouts_12mo,
            avg_delay_days,
            monthly_punctuality,
            paid_by_link,
            automation,
        })
    }

    async fn get_dashboard_kpis(
        &self,
        manager_id: Uuid,
    ) -> Result<DashboardKpisResponse, sqlx::Error> {
        let (total, active, pending, overdue_links, due_this_week, month_totals, overdue_worker_row) =
            tokio::try_join!(
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM links WHERE manager_id = $1",
                )
                .bind(manager_id)
                .fetch_one(&self.pool),

                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM links WHERE manager_id = $1 AND status = 'active'",
                )
                .bind(manager_id)
                .fetch_one(&self.pool),

                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM links WHERE manager_id = $1 AND status = 'pending'",
                )
                .bind(manager_id)
                .fetch_one(&self.pool),

                sqlx::query_scalar::<_, i64>(
                    r#"SELECT COUNT(DISTINCT l.id)
                       FROM links l
                       JOIN payment_configurations pc ON pc.link_id = l.id
                       WHERE l.manager_id = $1
                         AND l.status = 'active'
                         AND pc.valid_until IS NULL
                         AND pc.next_due_date < NOW()"#,
                )
                .bind(manager_id)
                .fetch_one(&self.pool),

                sqlx::query_scalar::<_, i64>(
                    r#"SELECT COUNT(*)
                       FROM payment_configurations pc
                       JOIN links l ON l.id = pc.link_id
                       WHERE l.manager_id = $1
                         AND l.status = 'active'
                         AND pc.valid_until IS NULL
                         AND pc.next_due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'"#,
                )
                .bind(manager_id)
                .fetch_one(&self.pool),

                sqlx::query_as::<_, (i64, i64)>(
                    r#"SELECT COALESCE(SUM(total_amount), 0)::BIGINT, COUNT(*)::BIGINT
                       FROM payouts
                       WHERE paid_by = $1
                         AND paid_at >= DATE_TRUNC('month', NOW())"#,
                )
                .bind(manager_id)
                .fetch_one(&self.pool),

                sqlx::query_as::<_, (String, i64)>(
                    r#"SELECT
                         u.first_name || ' ' || u.last_name,
                         GREATEST(EXTRACT(DAY FROM NOW() - pc.next_due_date)::BIGINT, 1)
                       FROM payment_configurations pc
                       JOIN links l ON l.id = pc.link_id
                       JOIN users u ON u.id = l.user_id
                       WHERE l.manager_id = $1
                         AND l.status = 'active'
                         AND pc.valid_until IS NULL
                         AND pc.next_due_date < NOW()
                       ORDER BY pc.next_due_date ASC
                       LIMIT 1"#,
                )
                .bind(manager_id)
                .fetch_optional(&self.pool),
            )?;

        let due_this_week_amounts = sqlx::query_as::<_, (String, i64)>(
            r#"SELECT pc.currency, COALESCE(SUM(pc.base_amount), 0)::BIGINT
               FROM payment_configurations pc
               JOIN links l ON l.id = pc.link_id
               WHERE l.manager_id = $1
                 AND l.status = 'active'
                 AND pc.valid_until IS NULL
                 AND pc.next_due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
               GROUP BY pc.currency
               ORDER BY SUM(pc.base_amount) DESC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(currency, total)| CurrencyTotal { currency, total })
        .collect();

        let (paid_this_month, paid_this_month_payouts) = month_totals;
        let overdue_worker = overdue_worker_row
            .map(|(name, days)| OverdueWorker { name, days_overdue: days });

        Ok(DashboardKpisResponse {
            total_links: total,
            active_links: active,
            pending_links: pending,
            overdue_links,
            due_this_week,
            due_this_week_amounts,
            paid_this_month,
            paid_this_month_payouts,
            overdue_worker,
        })
    }

    async fn get_dashboard_charts(
        &self,
        manager_id: Uuid,
    ) -> Result<DashboardChartsResponse, sqlx::Error> {
        let (
            monthly_trend_rows,
            status_row,
            currency_totals_rows,
            needs_attention_rows,
            punctuality_row,
            monthly_punctuality_rows,
            paid_by_link_rows,
            automation_row,
        ) = tokio::try_join!(
            sqlx::query_as::<_, (String, i64)>(
                r#"SELECT
                     TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon') AS month_label,
                     COALESCE(SUM(total_amount), 0)::BIGINT AS total
                   FROM payouts
                   WHERE paid_by = $1
                     AND paid_at >= NOW() - INTERVAL '12 months'
                   GROUP BY DATE_TRUNC('month', paid_at)
                   ORDER BY DATE_TRUNC('month', paid_at) ASC"#,
            )
            .bind(manager_id)
            .fetch_all(&self.pool),

            sqlx::query_as::<_, (i64, i64, i64, i64)>(
                r#"SELECT
                     COUNT(*) FILTER (WHERE l.status = 'active' AND (pc.next_due_date IS NULL OR pc.next_due_date >= NOW())) AS on_schedule,
                     COUNT(*) FILTER (WHERE l.status = 'active' AND pc.next_due_date < NOW()) AS overdue,
                     COUNT(*) FILTER (WHERE l.status = 'pending') AS pending_invite,
                     COUNT(*) FILTER (WHERE l.status IN ('inactive', 'terminated', 'suspended')) AS inactive
                   FROM links l
                   LEFT JOIN payment_configurations pc ON pc.link_id = l.id AND pc.valid_until IS NULL
                   WHERE l.manager_id = $1"#,
            )
            .bind(manager_id)
            .fetch_one(&self.pool),

            sqlx::query_as::<_, (String, i64)>(
                r#"SELECT currency, COALESCE(SUM(total_amount), 0)::BIGINT AS total
                   FROM payouts
                   WHERE paid_by = $1
                     AND paid_at >= DATE_TRUNC('year', NOW())
                   GROUP BY currency
                   ORDER BY total DESC"#,
            )
            .bind(manager_id)
            .fetch_all(&self.pool),

            sqlx::query_as::<_, (Uuid, String, String, i64, String, String)>(
                r#"SELECT
                     l.id,
                     u.first_name || ' ' || u.last_name AS worker_name,
                     TO_CHAR(pc.next_due_date AT TIME ZONE 'UTC', 'DD Mon') AS due_date,
                     pc.base_amount,
                     pc.currency,
                     CASE
                       WHEN pc.next_due_date < NOW() THEN 'Overdue'
                       WHEN pc.next_due_date < NOW() + INTERVAL '7 days' THEN 'Due soon'
                       ELSE 'Active'
                     END AS status
                   FROM links l
                   JOIN payment_configurations pc ON pc.link_id = l.id AND pc.valid_until IS NULL
                   JOIN users u ON u.id = l.user_id
                   WHERE l.manager_id = $1
                     AND l.status = 'active'
                     AND pc.next_due_date <= NOW() + INTERVAL '7 days'
                   ORDER BY pc.next_due_date ASC
                   LIMIT 8"#,
            )
            .bind(manager_id)
            .fetch_all(&self.pool),

            sqlx::query_as::<_, (i64, i64, Option<f64>)>(
                r#"SELECT
                     COUNT(*) FILTER (WHERE paid_at <= period_end)::BIGINT AS on_time,
                     COUNT(*)::BIGINT AS total,
                     AVG(GREATEST(0.0, EXTRACT(EPOCH FROM (paid_at - period_end))))
                         FILTER (WHERE paid_at > period_end) AS avg_delay_secs
                   FROM payouts
                   WHERE paid_by = $1
                     AND paid_at >= NOW() - INTERVAL '12 months'"#,
            )
            .bind(manager_id)
            .fetch_one(&self.pool),

            sqlx::query_as::<_, (String, i64, i64)>(
                r#"SELECT
                     TO_CHAR(DATE_TRUNC('month', period_end), 'Mon') AS month,
                     COUNT(*) FILTER (WHERE paid_at <= period_end)::BIGINT AS on_time,
                     COUNT(*) FILTER (WHERE paid_at > period_end)::BIGINT AS late
                   FROM payouts
                   WHERE paid_by = $1
                     AND paid_at >= NOW() - INTERVAL '12 months'
                   GROUP BY DATE_TRUNC('month', period_end),
                            TO_CHAR(DATE_TRUNC('month', period_end), 'Mon')
                   ORDER BY DATE_TRUNC('month', period_end) ASC"#,
            )
            .bind(manager_id)
            .fetch_all(&self.pool),

            sqlx::query_as::<_, (Uuid, String, i64, String)>(
                r#"SELECT
                     p.link_id,
                     u.first_name || ' ' || u.last_name AS worker_name,
                     SUM(p.total_amount)::BIGINT AS total_ytd,
                     MAX(p.currency) AS currency
                   FROM payouts p
                   JOIN links l ON l.id = p.link_id
                   JOIN users u ON u.id = l.user_id
                   WHERE p.paid_by = $1
                     AND p.paid_at >= DATE_TRUNC('year', NOW())
                   GROUP BY p.link_id, u.first_name, u.last_name
                   ORDER BY total_ytd DESC
                   LIMIT 10"#,
            )
            .bind(manager_id)
            .fetch_all(&self.pool),

            sqlx::query_as::<_, (i64, i64, i64)>(
                r#"SELECT
                     COUNT(*) FILTER (WHERE EXISTS (
                         SELECT 1 FROM payment_configurations pc
                         WHERE pc.link_id = l.id AND pc.valid_until IS NULL
                     ))::BIGINT AS configured,
                     COUNT(*) FILTER (WHERE NOT EXISTS (
                         SELECT 1 FROM payment_configurations pc
                         WHERE pc.link_id = l.id AND pc.valid_until IS NULL
                     ))::BIGINT AS not_configured,
                     COUNT(*)::BIGINT AS active_total
                   FROM links l
                   WHERE l.manager_id = $1 AND l.status = 'active'"#,
            )
            .bind(manager_id)
            .fetch_one(&self.pool),
        )?;

        let monthly_trend = monthly_trend_rows
            .into_iter()
            .map(|(month, total)| MonthlyTrend { month, total })
            .collect();

        let status_breakdown = PaymentStatusBreakdown {
            on_schedule: status_row.0,
            overdue: status_row.1,
            pending_invite: status_row.2,
            inactive: status_row.3,
        };

        let currency_totals = currency_totals_rows
            .into_iter()
            .map(|(currency, total)| CurrencyTotal { currency, total })
            .collect();

        let needs_attention = needs_attention_rows
            .into_iter()
            .map(|(link_id, worker_name, due_date, amount, currency, status)| AttentionItem {
                link_id,
                worker_name,
                due_date,
                amount,
                currency,
                status,
            })
            .collect();

        let (on_time_count, total_payouts_12mo, avg_delay_secs) = punctuality_row;
        let on_time_rate = if total_payouts_12mo > 0 {
            (on_time_count as f64 / total_payouts_12mo as f64) * 100.0
        } else {
            0.0
        };
        let avg_delay_days = avg_delay_secs.unwrap_or(0.0) / 86400.0;

        let monthly_punctuality = monthly_punctuality_rows
            .into_iter()
            .map(|(month, on_time, late)| PunctualityMonth { month, on_time, late })
            .collect();

        let paid_by_link = paid_by_link_rows
            .into_iter()
            .map(|(link_id, worker_name, total_ytd, currency)| LinkYtdPayout {
                link_id,
                worker_name,
                total_ytd,
                currency,
            })
            .collect();

        let (configured, not_configured, active_total) = automation_row;
        let automation = AutomationStats { configured, not_configured, active_total };

        Ok(DashboardChartsResponse {
            monthly_trend,
            status_breakdown,
            currency_totals,
            needs_attention,
            on_time_rate,
            total_payouts_12mo,
            avg_delay_days,
            monthly_punctuality,
            paid_by_link,
            automation,
        })
    }

    async fn record_payout(
        &self,
        manager_id: Uuid,
        link_id: Uuid,
        base_amount: i64,
        currency: &str,
        paid_at: DateTime<Utc>,
        notes: Option<&str>,
        proof_of_payment: Option<&str>,
    ) -> Result<Uuid, sqlx::Error> {
        // payment_config_id is optional — links without a config can still receive ad-hoc payments
        let config_id = sqlx::query_scalar::<_, Uuid>(
            r#"SELECT id FROM payment_configurations
               WHERE link_id = $1 AND valid_until IS NULL
               ORDER BY valid_from DESC LIMIT 1"#,
        )
        .bind(link_id)
        .fetch_optional(&self.pool)
        .await?;

        // period_start: last payout date, or config anchor, or paid_at as fallback
        let period_start: chrono::DateTime<Utc> = if let Some(cid) = config_id {
            sqlx::query_scalar::<_, chrono::DateTime<Utc>>(
                r#"SELECT COALESCE(
                     (SELECT paid_at FROM payouts WHERE link_id = $1 ORDER BY paid_at DESC LIMIT 1),
                     (SELECT cycle_anchor_date FROM payment_configurations WHERE id = $2)
                   )"#,
            )
            .bind(link_id)
            .bind(cid)
            .fetch_one(&self.pool)
            .await
            .unwrap_or(paid_at)
        } else {
            sqlx::query_scalar::<_, chrono::DateTime<Utc>>(
                r#"SELECT paid_at FROM payouts WHERE link_id = $1 ORDER BY paid_at DESC LIMIT 1"#,
            )
            .bind(link_id)
            .fetch_optional(&self.pool)
            .await?
            .unwrap_or(paid_at)
        };

        let payout_id = sqlx::query_scalar::<_, Uuid>(
            r#"INSERT INTO payouts
               (link_id, paid_by, payment_config_id, period_start, period_end,
                base_amount, total_amount, currency, notes, proof_of_payment, status, paid_at)
               VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, 'completed', $10)
               RETURNING id"#,
        )
        .bind(link_id)
        .bind(manager_id)
        .bind(config_id)
        .bind(period_start)
        .bind(paid_at)
        .bind(base_amount)
        .bind(currency)
        .bind(notes)
        .bind(proof_of_payment)
        .bind(paid_at)
        .fetch_one(&self.pool)
        .await?;

        Ok(payout_id)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Resolves the manager ID for the given user.  Returns `ApiError::Forbidden`
/// when the user has no manager record, so callers can propagate with `?`.
async fn resolve_manager_id(
    state: &AppState,
    user_id: Uuid,
) -> Result<Uuid, ApiError> {
    match state.db.find_manager_id_for_user(user_id).await {
        Ok(Some(id)) => Ok(id),
        Ok(None) => Err(ApiError::Forbidden("Manager account not found".to_string())),
        Err(e) => Err(ApiError::Database(e, "Failed to resolve manager")),
    }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn list_links(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<Vec<LinkSummary>>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let rows = sqlx::query_as::<_, (
        Uuid,
        String,
        String,
        String,
        LinkStatus,
        Option<String>,
        Option<i64>,
        Option<String>,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
    )>(
        r#"SELECT
             l.id,
             u.first_name || ' ' || u.last_name AS worker_name,
             COALESCE(ai.provider_user_id, '') AS worker_email,
             l.job_type,
             l.status,
             pc.pay_schedule::TEXT,
             pc.base_amount,
             pc.currency,
             pc.next_due_date,
             (SELECT MAX(p.paid_at) FROM payouts p WHERE p.link_id = l.id)
           FROM links l
           JOIN users u ON u.id = l.user_id
           LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
           LEFT JOIN payment_configurations pc
             ON pc.link_id = l.id AND pc.valid_until IS NULL
           WHERE l.manager_id = $1
           ORDER BY l.created_at DESC"#,
    )
    .bind(manager_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to retrieve links"))?;

    let summaries: Vec<LinkSummary> = rows
        .into_iter()
        .map(|(id, worker_name, worker_email, job_type, status, pay_schedule, base_amount, currency, next_due_date, last_paid_date)| {
            LinkSummary { id, worker_name, worker_email, job_type, status, pay_schedule, base_amount, currency, next_due_date, last_paid_date }
        })
        .collect();

    let is_empty = summaries.is_empty();

    Ok(ApiResponse {
        http_status: if is_empty { StatusCode::NO_CONTENT } else { StatusCode::OK },
        status: true,
        message: if is_empty {
            String::from("No links found")
        } else {
            String::from("Links retrieved successfully")
        },
        data: if is_empty { None } else { Some(summaries) },
    })
}

async fn create_link(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Json(body): Json<CreateLinkRequest>,
) -> Result<ApiResponse<CreateLinkResponse>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let (link_count, quota_approved) = state
        .db
        .get_links_quota_status(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to check link quota"))?;

    if link_count >= LINK_FREE_QUOTA && !quota_approved {
        return Err(ApiError::Forbidden(format!(
            "Link quota of {} reached. Contact support to request an increase.",
            LINK_FREE_QUOTA
        )));
    }

    // Three paths:
    //   1. Email-provider identity exists → use their user_id, link active
    //   2. User row exists but via OAuth (no email-provider identity) → use their user_id
    //   3. No account at all → create placeholder user + invite token
    let existing_identity = state
        .db
        .find_identity_by_email(&body.worker_email)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to look up worker account"))?;

    let (worker_user_id, invite_token) = if let Some(identity) = existing_identity {
        (identity.user_id, None)
    } else {
        let existing_user_id = state
            .db
            .find_user_id_by_email(&body.worker_email)
            .await
            .map_err(|e| ApiError::Database(e, "Failed to look up worker account"))?;

        if let Some(uid) = existing_user_id {
            (uid, None)
        } else {
            let (uid, token) = state
                .db
                .create_worker_invite(&body.worker_email)
                .await
                .map_err(|e| ApiError::Database(e, "Failed to create worker invite"))?;
            (uid, Some(token.to_string()))
        }
    };

    let link = state
        .db
        .create_link_for_manager(
            manager_id,
            worker_user_id,
            &body.job_type,
            body.start_date,
            &body.home_country,
            &body.work_country,
            body.home_city.as_deref(),
            body.work_city.as_deref(),
        )
        .await
        .map_err(|e| ApiError::Database(e, "Failed to create link"))?;

    let message = if invite_token.is_some() {
        "Link created. An invite has been generated for the worker."
    } else {
        "Link created successfully"
    };

    Ok(ApiResponse {
        http_status: StatusCode::CREATED,
        status: true,
        message: String::from(message),
        data: Some(CreateLinkResponse {
            link: LinkSummary {
                id: link.id,
                worker_name: String::new(),
                worker_email: body.worker_email,
                job_type: link.job_type,
                status: link.status,
                pay_schedule: None,
                base_amount: None,
                currency: None,
                next_due_date: None,
                last_paid_date: None,
            },
            invite_token,
        }),
    })
}

async fn dashboard_summary(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<DashboardSummary>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let summary = state
        .db
        .get_full_dashboard(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve dashboard data"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Dashboard data retrieved"),
        data: Some(summary),
    })
}

async fn dashboard_kpis(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<DashboardKpisResponse>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let kpis = state
        .db
        .get_dashboard_kpis(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve KPI data"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("KPI data retrieved"),
        data: Some(kpis),
    })
}

async fn dashboard_charts(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<DashboardChartsResponse>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let charts = state
        .db
        .get_dashboard_charts(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve chart data"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Chart data retrieved"),
        data: Some(charts),
    })
}

async fn get_quota_status(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<LinkQuotaStatus>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let (link_count, quota_approved) = state
        .db
        .get_links_quota_status(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve quota status"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Quota status retrieved"),
        data: Some(LinkQuotaStatus {
            link_count,
            quota_approved,
            can_add_links: quota_approved || link_count < LINK_FREE_QUOTA,
        }),
    })
}

async fn record_payout_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Json(body): Json<RecordPayoutRequest>,
) -> Result<ApiResponse<CreatedPayout>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    // Verify the link belongs to the requesting manager.
    let link_owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM links WHERE id = $1 AND manager_id = $2)",
    )
    .bind(body.link_id)
    .bind(manager_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to verify link ownership"))?;

    if !link_owned {
        return Err(ApiError::NotFound("Link not found".to_string()));
    }

    // Worker must have configured their payment details before a payout can be recorded.
    let has_payment_details = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM link_payment_details WHERE link_id = $1)",
    )
    .bind(body.link_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to check payment details"))?;

    if !has_payment_details {
        return Err(ApiError::BadRequest(
            "Worker has not set up their payment details yet. Ask the worker to go to their app and fill in their bank information before recording a payment.".to_string(),
        ));
    }

    let proof_url: Option<String> = body
        .proof_key
        .as_deref()
        .map(|key| state.storage.public_url(key));

    let id = state
        .db
        .record_payout(
            manager_id,
            body.link_id,
            body.base_amount,
            &body.currency,
            body.paid_at,
            body.notes.as_deref(),
            proof_url.as_deref(),
        )
        .await
        .map_err(|e| ApiError::Database(e, "Failed to record payment"))?;

    Ok(ApiResponse {
        http_status: StatusCode::CREATED,
        status: true,
        message: String::from("Payment recorded"),
        data: Some(CreatedPayout { id }),
    })
}

// ── Devices / Routers / Overtime DTOs ────────────────────────────────────────

#[derive(Serialize)]
pub struct DeviceSummary {
    pub id: Uuid,
    pub name: String,
    pub device_type: String,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub status: String,
    pub current_link_name: Option<String>,
}

#[derive(Serialize)]
pub struct RouterSummary {
    pub id: Uuid,
    pub name: String,
    pub router_type: String,
    pub model_number: Option<String>,
    pub routes_to: String,
    pub ip_addr: String,
    pub status: String,
    pub current_link_name: Option<String>,
}

#[derive(Serialize)]
pub struct OvertimePolicySummary {
    pub id: Uuid,
    pub name: String,
    pub overtime_enabled: bool,
    pub multiplier: Option<f64>,
    pub flat_rate: Option<i64>,
    pub threshold_hours: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateOvertimeRequest {
    pub name: String,
    pub overtime_enabled: bool,
    pub multiplier: Option<f64>,
    pub flat_rate: Option<i64>,
    pub threshold_hours: Option<i32>,
}

#[derive(Deserialize)]
pub struct CreateDeviceRequest {
    pub name: String,
    pub device_type: String,
    pub model: Option<String>,
    pub serial_number: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateRouterRequest {
    pub name: String,
    pub router_type: String,
    pub model_number: Option<String>,
    pub routes_to: String,
    pub ip_addr: String,
}

#[derive(Serialize)]
pub struct RouterDetail {
    pub id: Uuid,
    pub name: String,
    pub router_type: String,
    pub model_number: Option<String>,
    pub routes_to: String,
    pub ip_addr: String,
    pub status: String,
    pub current_link_id: Option<Uuid>,
    pub current_link_name: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateRouterRequest {
    pub name: Option<String>,
    pub router_type: Option<String>,
    pub model_number: Option<String>,
    pub routes_to: Option<String>,
    pub ip_addr: Option<String>,
}

#[derive(Deserialize)]
pub struct AssignRouterRequest {
    pub link_id: Option<Uuid>,
}

// ── Repository extension trait ────────────────────────────────────────────────

pub trait ManagerAssetsRepository {
    fn find_devices_for_manager(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Vec<DeviceSummary>, sqlx::Error>> + Send;

    fn create_device(
        &self,
        manager_id: Uuid,
        req: &CreateDeviceRequest,
    ) -> impl std::future::Future<Output = Result<Uuid, sqlx::Error>> + Send;

    fn find_routers_for_manager(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Vec<RouterSummary>, sqlx::Error>> + Send;

    fn create_router(
        &self,
        manager_id: Uuid,
        req: &CreateRouterRequest,
    ) -> impl std::future::Future<Output = Result<Uuid, sqlx::Error>> + Send;

    fn get_router(
        &self,
        manager_id: Uuid,
        router_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<RouterDetail>, sqlx::Error>> + Send;

    fn update_router(
        &self,
        manager_id: Uuid,
        router_id: Uuid,
        req: &UpdateRouterRequest,
    ) -> impl std::future::Future<Output = Result<bool, sqlx::Error>> + Send;

    fn assign_router(
        &self,
        manager_id: Uuid,
        router_id: Uuid,
        link_id: Option<Uuid>,
    ) -> impl std::future::Future<Output = Result<bool, sqlx::Error>> + Send;

    fn find_overtime_policies(
        &self,
        manager_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Vec<OvertimePolicySummary>, sqlx::Error>> + Send;

    fn create_overtime_policy(
        &self,
        manager_id: Uuid,
        req: &CreateOvertimeRequest,
    ) -> impl std::future::Future<Output = Result<Uuid, sqlx::Error>> + Send;
}

impl ManagerAssetsRepository for PostgresDbPool {
    async fn find_devices_for_manager(
        &self,
        manager_id: Uuid,
    ) -> Result<Vec<DeviceSummary>, sqlx::Error> {
        sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<String>, String, Option<String>)>(
            r#"SELECT d.id, d.name, d.device_type::text, d.model, d.serial_number, d.status::text,
                      u.first_name || ' ' || u.last_name
               FROM devices d
               LEFT JOIN links l ON l.id = d.current_link_id
               LEFT JOIN users u ON u.id = l.user_id
               WHERE d.manager_id = $1
               ORDER BY d.created_at DESC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await
        .map(|rows| {
            rows.into_iter()
                .map(|(id, name, device_type, model, serial_number, status, current_link_name)| {
                    DeviceSummary { id, name, device_type, model, serial_number, status, current_link_name }
                })
                .collect()
        })
    }

    async fn create_device(
        &self,
        manager_id: Uuid,
        req: &CreateDeviceRequest,
    ) -> Result<Uuid, sqlx::Error> {
        let device_type = req.device_type.as_str();
        sqlx::query_scalar::<_, Uuid>(
            r#"INSERT INTO devices (manager_id, name, device_type, model, serial_number)
               VALUES ($1, $2, $3::device_type, $4, $5)
               RETURNING id"#,
        )
        .bind(manager_id)
        .bind(&req.name)
        .bind(device_type)
        .bind(&req.model)
        .bind(&req.serial_number)
        .fetch_one(&self.pool)
        .await
    }

    async fn find_routers_for_manager(
        &self,
        manager_id: Uuid,
    ) -> Result<Vec<RouterSummary>, sqlx::Error> {
        sqlx::query_as::<_, (Uuid, String, String, Option<String>, String, String, String, Option<String>)>(
            r#"SELECT r.id, r.name, r.router_type::text, r.model_number, r.routes_to, r.ip_addr::text, r.status::text,
                      u.first_name || ' ' || u.last_name
               FROM router_gateways r
               LEFT JOIN links l ON l.id = r.current_link_id
               LEFT JOIN users u ON u.id = l.user_id
               WHERE r.manager_id = $1
               ORDER BY r.created_at DESC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await
        .map(|rows| {
            rows.into_iter()
                .map(|(id, name, router_type, model_number, routes_to, ip_addr, status, current_link_name)| {
                    RouterSummary { id, name, router_type, model_number, routes_to, ip_addr, status, current_link_name }
                })
                .collect()
        })
    }

    async fn create_router(
        &self,
        manager_id: Uuid,
        req: &CreateRouterRequest,
    ) -> Result<Uuid, sqlx::Error> {
        let router_type = req.router_type.as_str();
        sqlx::query_scalar::<_, Uuid>(
            r#"INSERT INTO router_gateways (manager_id, name, router_type, model_number, routes_to, ip_addr)
               VALUES ($1, $2, $3::router_type, $4, $5, $6::inet)
               RETURNING id"#,
        )
        .bind(manager_id)
        .bind(&req.name)
        .bind(router_type)
        .bind(&req.model_number)
        .bind(&req.routes_to)
        .bind(&req.ip_addr)
        .fetch_one(&self.pool)
        .await
    }

    async fn get_router(
        &self,
        manager_id: Uuid,
        router_id: Uuid,
    ) -> Result<Option<RouterDetail>, sqlx::Error> {
        sqlx::query_as::<_, (Uuid, String, String, Option<String>, String, String, String, Option<Uuid>, Option<String>)>(
            r#"SELECT r.id, r.name, r.router_type::text, r.model_number, r.routes_to, r.ip_addr::text, r.status::text,
                      r.current_link_id,
                      u.first_name || ' ' || u.last_name
               FROM router_gateways r
               LEFT JOIN links l ON l.id = r.current_link_id
               LEFT JOIN users u ON u.id = l.user_id
               WHERE r.id = $1 AND r.manager_id = $2"#,
        )
        .bind(router_id)
        .bind(manager_id)
        .fetch_optional(&self.pool)
        .await
        .map(|row| {
            row.map(|(id, name, router_type, model_number, routes_to, ip_addr, status, current_link_id, current_link_name)| {
                RouterDetail { id, name, router_type, model_number, routes_to, ip_addr, status, current_link_id, current_link_name }
            })
        })
    }

    async fn update_router(
        &self,
        manager_id: Uuid,
        router_id: Uuid,
        req: &UpdateRouterRequest,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query(
            r#"UPDATE router_gateways
               SET name         = COALESCE($3, name),
                   router_type  = COALESCE($4::router_type, router_type),
                   model_number = COALESCE($5, model_number),
                   routes_to    = COALESCE($6, routes_to),
                   ip_addr      = COALESCE($7::inet, ip_addr),
                   updated_at   = NOW()
               WHERE id = $1 AND manager_id = $2"#,
        )
        .bind(router_id)
        .bind(manager_id)
        .bind(&req.name)
        .bind(&req.router_type)
        .bind(&req.model_number)
        .bind(&req.routes_to)
        .bind(&req.ip_addr)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn assign_router(
        &self,
        manager_id: Uuid,
        router_id: Uuid,
        link_id: Option<Uuid>,
    ) -> Result<bool, sqlx::Error> {
        // Verify router belongs to manager
        let exists: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM router_gateways WHERE id = $1 AND manager_id = $2",
        )
        .bind(router_id)
        .bind(manager_id)
        .fetch_optional(&self.pool)
        .await?;

        if exists.is_none() {
            return Ok(false);
        }

        // Close any open assignment
        sqlx::query(
            "UPDATE router_assignments SET returned_at = NOW() WHERE router_id = $1 AND returned_at IS NULL",
        )
        .bind(router_id)
        .execute(&self.pool)
        .await?;

        if let Some(lid) = link_id {
            // Open a new assignment record
            sqlx::query(
                r#"INSERT INTO router_assignments (router_id, link_id, assigned_by)
                   VALUES ($1, $2, $3)"#,
            )
            .bind(router_id)
            .bind(lid)
            .bind(manager_id)
            .execute(&self.pool)
            .await?;

            sqlx::query(
                "UPDATE router_gateways SET current_link_id = $2, status = 'with_link', updated_at = NOW() WHERE id = $1",
            )
            .bind(router_id)
            .bind(lid)
            .execute(&self.pool)
            .await?;
        } else {
            sqlx::query(
                "UPDATE router_gateways SET current_link_id = NULL, status = 'with_manager', updated_at = NOW() WHERE id = $1",
            )
            .bind(router_id)
            .execute(&self.pool)
            .await?;
        }

        Ok(true)
    }

    async fn find_overtime_policies(
        &self,
        manager_id: Uuid,
    ) -> Result<Vec<OvertimePolicySummary>, sqlx::Error> {
        sqlx::query_as::<_, (Uuid, String, bool, Option<f64>, Option<i64>, Option<i32>, DateTime<Utc>)>(
            r#"SELECT id, name, overtime_enabled, multiplier, flat_rate, threshold_hours, created_at
               FROM overtime_policies WHERE manager_id = $1
               ORDER BY created_at DESC"#,
        )
        .bind(manager_id)
        .fetch_all(&self.pool)
        .await
        .map(|rows| {
            rows.into_iter()
                .map(|(id, name, overtime_enabled, multiplier, flat_rate, threshold_hours, created_at)| {
                    OvertimePolicySummary { id, name, overtime_enabled, multiplier, flat_rate, threshold_hours, created_at }
                })
                .collect()
        })
    }

    async fn create_overtime_policy(
        &self,
        manager_id: Uuid,
        req: &CreateOvertimeRequest,
    ) -> Result<Uuid, sqlx::Error> {
        sqlx::query_scalar::<_, Uuid>(
            r#"INSERT INTO overtime_policies (manager_id, name, overtime_enabled, multiplier, flat_rate, threshold_hours)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id"#,
        )
        .bind(manager_id)
        .bind(&req.name)
        .bind(req.overtime_enabled)
        .bind(req.multiplier)
        .bind(req.flat_rate)
        .bind(req.threshold_hours)
        .fetch_one(&self.pool)
        .await
    }
}

// ── Asset / router / overtime handlers ────────────────────────────────────────

async fn list_devices_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<Vec<DeviceSummary>>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let devices = state
        .db
        .find_devices_for_manager(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve devices"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Devices retrieved"),
        data: Some(devices),
    })
}

async fn create_device_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Json(body): Json<CreateDeviceRequest>,
) -> Result<ApiResponse<Uuid>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let id = state
        .db
        .create_device(manager_id, &body)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to register device"))?;

    Ok(ApiResponse {
        http_status: StatusCode::CREATED,
        status: true,
        message: String::from("Device registered"),
        data: Some(id),
    })
}

async fn list_routers_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<Vec<RouterSummary>>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let routers = state
        .db
        .find_routers_for_manager(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve routers"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Routers retrieved"),
        data: Some(routers),
    })
}

async fn create_router_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Json(body): Json<CreateRouterRequest>,
) -> Result<ApiResponse<Uuid>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let id = state
        .db
        .create_router(manager_id, &body)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to register router"))?;

    Ok(ApiResponse {
        http_status: StatusCode::CREATED,
        status: true,
        message: String::from("Router registered"),
        data: Some(id),
    })
}

async fn get_router_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Path(router_id): Path<Uuid>,
) -> Result<ApiResponse<RouterDetail>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let router = state
        .db
        .get_router(manager_id, router_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve router"))?
        .ok_or(ApiError::NotFound("Router not found".to_string()))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Router retrieved"),
        data: Some(router),
    })
}

async fn update_router_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Path(router_id): Path<Uuid>,
    Json(body): Json<UpdateRouterRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let updated = state
        .db
        .update_router(manager_id, router_id, &body)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to update router"))?;

    if !updated {
        return Err(ApiError::NotFound("Router not found".to_string()));
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Router updated"),
        data: None,
    })
}

async fn assign_router_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Path(router_id): Path<Uuid>,
    Json(body): Json<AssignRouterRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let ok = state
        .db
        .assign_router(manager_id, router_id, body.link_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to assign router"))?;

    if !ok {
        return Err(ApiError::NotFound("Router not found".to_string()));
    }

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: if body.link_id.is_some() {
            String::from("Router assigned")
        } else {
            String::from("Router unassigned")
        },
        data: None,
    })
}

async fn list_overtime_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
) -> Result<ApiResponse<Vec<OvertimePolicySummary>>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let policies = state
        .db
        .find_overtime_policies(manager_id)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to retrieve overtime policies"))?;

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Overtime policies retrieved"),
        data: Some(policies),
    })
}

async fn create_overtime_handler(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Json(body): Json<CreateOvertimeRequest>,
) -> Result<ApiResponse<Uuid>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let id = state
        .db
        .create_overtime_policy(manager_id, &body)
        .await
        .map_err(|e| ApiError::Database(e, "Failed to create overtime policy"))?;

    Ok(ApiResponse {
        http_status: StatusCode::CREATED,
        status: true,
        message: String::from("Overtime policy created"),
        data: Some(id),
    })
}

async fn get_link_detail(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Path(link_id): Path<Uuid>,
) -> Result<ApiResponse<LinkDetail>, ApiError> {
    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    let row = sqlx::query_as::<_, (
        Uuid,
        String,
        String,
        LinkStatus,
        DateTime<Utc>,
        String,
        Option<String>,
        String,
        Option<String>,
        Option<String>,
        Option<i64>,
        Option<String>,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
    )>(
        r#"SELECT
             l.id,
             u.first_name || ' ' || u.last_name,
             l.job_type,
             l.status,
             l.start_date,
             l.home_country,
             l.home_city,
             l.work_country,
             l.work_city,
             pc.pay_schedule::TEXT,
             pc.base_amount,
             pc.currency,
             pc.next_due_date,
             (SELECT MAX(p.paid_at) FROM payouts p WHERE p.link_id = l.id)
           FROM links l
           JOIN users u ON u.id = l.user_id
           LEFT JOIN payment_configurations pc
             ON pc.link_id = l.id AND pc.valid_until IS NULL
           WHERE l.id = $1 AND l.manager_id = $2"#,
    )
    .bind(link_id)
    .bind(manager_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to retrieve link"))?
    .ok_or_else(|| ApiError::NotFound("Link not found".to_string()))?;

    let (id, worker_name, job_type, status, start_date, home_country, home_city, work_country, work_city, pay_schedule, base_amount, currency, next_due_date, last_paid_date) = row;

    let payout_rows = sqlx::query_as::<_, (
        Uuid,
        DateTime<Utc>,
        DateTime<Utc>,
        i64,
        Option<i64>,
        Option<i64>,
        i64,
        String,
        String,
        DateTime<Utc>,
        Option<String>,
    )>(
        r#"SELECT
             id,
             period_start,
             period_end,
             base_amount,
             overtime_amount,
             bonus_amount,
             total_amount,
             currency,
             status::TEXT,
             paid_at,
             proof_of_payment
           FROM payouts
           WHERE link_id = $1
           ORDER BY paid_at DESC
           LIMIT 24"#,
    )
    .bind(link_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to retrieve payouts"))?;

    let payouts = payout_rows
        .into_iter()
        .map(|(pid, period_start, period_end, base, overtime, bonus, total, cur, st, paid, proof)| {
            let label = format!(
                "{} – {}",
                period_start.format("%d %b %Y"),
                period_end.format("%d %b %Y")
            );
            LinkPayoutRow {
                id: pid,
                period_label: label,
                base_amount: base,
                overtime_amount: overtime,
                bonus_amount: bonus,
                total_amount: total,
                currency: cur,
                status: st,
                paid_at: Some(paid),
                proof_of_payment: proof,
            }
        })
        .collect();

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: String::from("Link retrieved successfully"),
        data: Some(LinkDetail {
            id,
            worker_name,
            job_type,
            status,
            start_date,
            home_country,
            home_city,
            work_country,
            work_city,
            pay_schedule,
            base_amount,
            currency,
            next_due_date,
            last_paid_date,
            payouts,
        }),
    })
}

// ── Update link status (terminate / suspend / reactivate) ─────────────────────

#[derive(Deserialize)]
struct UpdateLinkStatusRequest {
    /// Must be one of: "active", "suspended", "terminated"
    status: String,
}

async fn update_link_status(
    State(state): State<AppState>,
    ManagerClaims(claims): ManagerClaims,
    Path(link_id): Path<Uuid>,
    Json(body): Json<UpdateLinkStatusRequest>,
) -> Result<ApiResponse<()>, ApiError> {
    let allowed = ["active", "suspended", "terminated"];
    if !allowed.contains(&body.status.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid status. Allowed values: {}",
            allowed.join(", ")
        )));
    }

    let user_id = parse_user_id(&claims.sub)?;
    let manager_id = resolve_manager_id(&state, user_id).await?;

    // Termination is irreversible — block re-activation of terminated links.
    let current: Option<(String,)> = sqlx::query_as(
        "SELECT status::TEXT FROM links WHERE id = $1 AND manager_id = $2",
    )
    .bind(link_id)
    .bind(manager_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to verify link ownership"))?;

    let (current_status,) =
        current.ok_or_else(|| ApiError::NotFound("Link not found".to_string()))?;

    if current_status == "terminated" {
        return Err(ApiError::BadRequest(
            "Terminated links cannot be changed.".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE links SET status = $1::link_status, updated_at = NOW()
         WHERE id = $2 AND manager_id = $3",
    )
    .bind(&body.status)
    .bind(link_id)
    .bind(manager_id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| ApiError::Database(e, "Failed to update link status"))?;

    let msg = match body.status.as_str() {
        "terminated" => "Link terminated.",
        "suspended" => "Link suspended.",
        "active" => "Link reactivated.",
        _ => "Status updated.",
    };

    Ok(ApiResponse {
        http_status: StatusCode::OK,
        status: true,
        message: msg.to_string(),
        data: None,
    })
}
