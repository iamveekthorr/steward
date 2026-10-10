export { API_BASE } from "./api-base";
import { API_BASE } from "./api-base";

// Access token duration matches ACCESS_TOKEN_EXPIRY_SECS on the API (900 s).
const ACCESS_TOKEN_MAX_AGE = 900;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

// Expose cookie setter so login/accept-invite pages can still set the JS-visible
// cookie that Next.js middleware reads for routing decisions.  The access token is
// ALSO returned as a httpOnly cookie by the API, which protects it from XSS.
export function setAuthCookie(token: string) {
  document.cookie = `access_token=${token}; path=/; SameSite=Lax; max-age=${ACCESS_TOKEN_MAX_AGE}`;
}

export function clearAuthCookie() {
  document.cookie = "access_token=; path=/; SameSite=Lax; max-age=0";
}

let refreshing: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  // POST to refresh with credentials so the httpOnly refresh_token cookie is
  // sent automatically.  The refresh_token stored in localStorage is also sent
  // in the body as a fallback for clients that haven't received the httpOnly
  // cookie yet (e.g. first login before the cookie was introduced).
  const rt = getRefreshToken();
  const body = rt ? JSON.stringify({ refresh_token: rt }) : "{}";

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const resBody = await res.json();
  if (!res.ok) throw new Error(resBody.message ?? "Refresh failed");

  const newToken: string = resBody.data.access_token;
  // Keep localStorage in sync (middleware routing) and update the JS-visible cookie.
  localStorage.setItem("access_token", newToken);
  setAuthCookie(newToken);
  return newToken;
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include", // Send httpOnly cookies (access + refresh tokens).
    headers: {
      "Content-Type": "application/json",
      // Keep Authorization header so non-cookie clients (curl, Postman) still work.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });

  // Only attempt token refresh when we actually sent an access token. Without
  // one we are on an unauthenticated endpoint (login, register…); a 401 there
  // means "wrong credentials", not an expired session, so surface it directly.
  if (res.status === 401 && !isRetry && typeof window !== "undefined" && token !== null) {
    try {
      if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
      await refreshing;
      return request<T>(path, init, true);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      clearAuthCookie();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  if (res.status === 204) {
    return { status: true, message: "No content", data: null } as T;
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    // Response is not JSON (e.g. HTML error page from a misconfigured proxy).
    throw new Error(
      res.ok
        ? "Unexpected response from server"
        : res.status === 503
        ? "Service unavailable. Please try again later."
        : res.status === 502
        ? "Service unavailable. Please try again later."
        : `Server error (${res.status})`,
    );
  }

  if (!res.ok) {
    throw new Error((body.message as string | undefined) ?? "Request failed");
  }

  return body as T;
}

export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T | null;
}

export interface UserDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface LinkSummary {
  id: string;
  worker_name: string;
  worker_email: string;
  job_type: string;
  pay_schedule: string | null;
  base_amount: number | null;
  currency: string | null;
  status: string;
  next_due_date: string | null;
  last_paid_date: string | null;
}

export interface LinkPayoutRow {
  id: string;
  period_label: string;
  base_amount: number;
  overtime_amount: number | null;
  bonus_amount: number | null;
  total_amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  proof_of_payment: string | null;
}

export interface LinkDetail {
  id: string;
  worker_name: string;
  job_type: string;
  status: string;
  start_date: string;
  home_country: string;
  home_city: string | null;
  work_country: string;
  work_city: string | null;
  pay_schedule: string | null;
  base_amount: number | null;
  currency: string | null;
  next_due_date: string | null;
  last_paid_date: string | null;
  payouts: LinkPayoutRow[];
}

export interface MonthlyTrend {
  month: string;
  total: number;
}

export interface PaymentStatusBreakdown {
  on_schedule: number;
  overdue: number;
  pending_invite: number;
  inactive: number;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export interface OverdueWorker {
  name: string;
  days_overdue: number;
}

export interface AttentionItem {
  link_id: string;
  worker_name: string;
  due_date: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PunctualityMonth {
  month: string;
  on_time: number;
  late: number;
}

export interface LinkYtdPayout {
  link_id: string;
  worker_name: string;
  total_ytd: number;
  currency: string;
}

export interface AutomationStats {
  configured: number;
  not_configured: number;
  active_total: number;
}

export interface DashboardSummary {
  active_links: number;
  due_this_week: number;
  due_this_week_amounts: CurrencyTotal[];
  overdue: number;
  overdue_worker: OverdueWorker | null;
  paid_this_month: number;
  paid_this_month_payouts: number;
  monthly_trend: MonthlyTrend[];
  status_breakdown: PaymentStatusBreakdown;
  currency_totals: CurrencyTotal[];
  needs_attention: AttentionItem[];
  on_time_rate: number;
  total_payouts_12mo: number;
  avg_delay_days: number;
  monthly_punctuality: PunctualityMonth[];
  paid_by_link: LinkYtdPayout[];
  automation: AutomationStats;
}

export interface DashboardKpisResponse {
  active_links: number;
  total_links: number;
  pending_links: number;
  overdue_links: number;
  due_this_week: number;
  due_this_week_amounts: CurrencyTotal[];
  paid_this_month: number;
  paid_this_month_payouts: number;
  overdue_worker: OverdueWorker | null;
}

export interface DashboardChartsResponse {
  monthly_trend: MonthlyTrend[];
  status_breakdown: PaymentStatusBreakdown;
  currency_totals: CurrencyTotal[];
  needs_attention: AttentionItem[];
  on_time_rate: number;
  total_payouts_12mo: number;
  avg_delay_days: number;
  monthly_punctuality: PunctualityMonth[];
  paid_by_link: LinkYtdPayout[];
  automation: AutomationStats;
}

export interface PayoutSummary {
  id: string;
  period_label: string;
  base_amount: number;
  overtime_amount: number | null;
  bonus_amount: number | null;
  total_amount: number;
  paid_at: string | null;
  status: string;
  currency: string;
  proof_of_payment: string | null;
}

export interface NextPayment {
  next_due_date: string;
  base_amount: number;
  currency: string;
  pay_schedule: string;
}

export interface LinkQuotaStatus {
  link_count: number;
  quota_approved: boolean;
  can_add_links: boolean;
}

export interface WorkerDetails {
  link_id: string;
  job_type: string;
  start_date: string;
  home_country: string;
  home_city: string | null;
  work_country: string;
  work_city: string | null;
  manager_name: string;
  pay_schedule: string | null;
  base_amount: number | null;
  currency: string | null;
  payment_method: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  preferred_currency: string | null;
}

export interface UpdateBankRequest {
  payment_method: string;
  bank_name?: string;
  bank_account_number?: string;
  preferred_currency: string;
}

export interface AssignedAsset {
  id: string;
  asset_type: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  status: string;
}

export interface WorkerAssets {
  devices: AssignedAsset[];
  routers: AssignedAsset[];
}

export interface DeviceSummary {
  id: string;
  name: string;
  device_type: string;
  model: string | null;
  serial_number: string | null;
  status: string;
  current_link_name: string | null;
}

export interface RouterSummary {
  id: string;
  name: string;
  router_type: string;
  model_number: string | null;
  routes_to: string;
  ip_addr: string;
  status: string;
  current_link_name: string | null;
}

export interface RouterDetail {
  id: string;
  name: string;
  router_type: string;
  model_number: string | null;
  routes_to: string;
  ip_addr: string;
  status: string;
  current_link_id: string | null;
  current_link_name: string | null;
}

export interface OvertimePolicySummary {
  id: string;
  name: string;
  overtime_enabled: boolean;
  multiplier: number | null;
  flat_rate: number | null;
  threshold_hours: number | null;
  created_at: string;
}

export interface UserSettings {
  theme: string;
  enable_email_notifications: boolean;
  reminder_days_before: number;
}

export const api = {
  auth: {
    register: (data: { first_name: string; last_name: string; email: string; password: string }) =>
      request<ApiResponse<{ verification_token: string }>>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request("/auth/login", { method: "POST", body: JSON.stringify(data) }),

    refresh: (refresh_token: string) =>
      request("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token }) }),

    logout: (access_token: string) =>
      request("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}` },
      }),

    forgotPassword: (email: string) =>
      request<ApiResponse<{ reset_token?: string }>>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    resetPassword: (data: { token: string; new_password: string }) =>
      request<ApiResponse<null>>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    changePassword: (data: { current_password: string; new_password: string }) =>
      request<ApiResponse<null>>("/auth/change-password", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    resendVerification: (email: string) =>
      request<ApiResponse<{ verification_token?: string }>>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    getInviteInfo: (token: string) =>
      request<ApiResponse<{
        manager_name: string;
        worker_email: string;
        job_type: string;
        start_date: string;
        base_amount: number | null;
        currency: string | null;
        pay_schedule: string | null;
      }>>(`/auth/invite-info?token=${encodeURIComponent(token)}`),

    acceptInvite: (data: { token: string; password: string }) =>
      request<ApiResponse<{
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
      }>>("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  users: {
    me: () => request<ApiResponse<UserDto>>("/users/me"),
  },

  manager: {
    dashboard: () => request<ApiResponse<DashboardSummary>>("/manager/dashboard"),
    dashboardKpis: () => request<ApiResponse<DashboardKpisResponse>>("/manager/dashboard/kpis"),
    dashboardCharts: () => request<ApiResponse<DashboardChartsResponse>>("/manager/dashboard/charts"),
    links: () => request<ApiResponse<LinkSummary[]>>("/manager/links"),
    quota: () => request<ApiResponse<LinkQuotaStatus>>("/manager/quota"),
    createLink: (body: {
      worker_email: string;
      job_type: string;
      start_date: string;
      home_country: string;
      work_country: string;
      home_city?: string;
      work_city?: string;
    }) =>
      request<ApiResponse<LinkSummary>>("/manager/links", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    recordPayment: (body: {
      link_id: string;
      base_amount: number;
      currency: string;
      paid_at: string;
      notes?: string;
      proof_key?: string;
    }) =>
      request<ApiResponse<{ id: string }>>("/manager/payouts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    linkDetail: (id: string) => request<ApiResponse<LinkDetail>>(`/manager/links/${id}`),
    updateLinkStatus: (id: string, status: "active" | "suspended" | "terminated") =>
      request<ApiResponse<null>>(`/manager/links/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    devices: () => request<ApiResponse<DeviceSummary[]>>("/manager/devices"),
    createDevice: (body: {
      name: string;
      device_type: string;
      model?: string;
      serial_number?: string;
    }) =>
      request<ApiResponse<string>>("/manager/devices", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    routers: () => request<ApiResponse<RouterSummary[]>>("/manager/routers"),
    createRouter: (body: {
      name: string;
      router_type: string;
      model_number?: string;
      routes_to: string;
      ip_addr: string;
    }) =>
      request<ApiResponse<string>>("/manager/routers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getRouter: (id: string) =>
      request<ApiResponse<RouterDetail>>(`/manager/routers/${id}`),
    updateRouter: (id: string, body: {
      name?: string;
      router_type?: string;
      model_number?: string;
      routes_to?: string;
      ip_addr?: string;
    }) =>
      request<ApiResponse<null>>(`/manager/routers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    assignRouter: (id: string, link_id: string | null) =>
      request<ApiResponse<null>>(`/manager/routers/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ link_id }),
      }),
    overtime: () => request<ApiResponse<OvertimePolicySummary[]>>("/manager/overtime"),
    createOvertimePolicy: (body: {
      name: string;
      overtime_enabled: boolean;
      multiplier?: number;
      flat_rate?: number;
      threshold_hours?: number;
    }) =>
      request<ApiResponse<string>>("/manager/overtime", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  worker: {
    nextPayment: () => request<ApiResponse<NextPayment>>("/worker/next-payment"),
    payouts: () => request<ApiResponse<PayoutSummary[]>>("/worker/payouts"),
    details: () => request<ApiResponse<WorkerDetails>>("/worker/details"),
    updateBank: (body: UpdateBankRequest) =>
      request<ApiResponse<null>>("/worker/bank", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    assets: () => request<ApiResponse<WorkerAssets>>("/worker/assets"),
  },

  settings: {
    get: () => request<ApiResponse<UserSettings>>("/users/settings"),
    update: (body: Partial<UserSettings>) =>
      request<ApiResponse<null>>("/users/settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
};
