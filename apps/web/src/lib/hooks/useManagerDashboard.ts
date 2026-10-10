import useSWR from "swr";
import {
  api,
  type DashboardKpisResponse,
  type DashboardChartsResponse,
  type LinkSummary,
  type NextPayment,
  type PayoutSummary,
  type WorkerDetails,
  type WorkerAssets,
} from "@/lib/api";

function apiDataFetcher<T>(fn: () => Promise<{ data: T | null }>) {
  return () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("No internet connection. Check your network and try again.");
    }
    return fn().then((r) => r.data);
  };
}

// ── Manager hooks ─────────────────────────────────────────────────────────────

export function useManagerKpis() {
  return useSWR<DashboardKpisResponse | null>(
    "/manager/dashboard/kpis",
    apiDataFetcher(api.manager.dashboardKpis),
    { refreshInterval: 30_000, revalidateOnFocus: true }
  );
}

export function useManagerCharts() {
  return useSWR<DashboardChartsResponse | null>(
    "/manager/dashboard/charts",
    apiDataFetcher(api.manager.dashboardCharts),
    { refreshInterval: 1_800_000, revalidateOnFocus: false }
  );
}

export function useManagerLinks() {
  return useSWR<LinkSummary[] | null>(
    "/manager/links",
    apiDataFetcher(api.manager.links),
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );
}

// ── Worker hooks ──────────────────────────────────────────────────────────────

export function useWorkerNextPayment() {
  return useSWR<NextPayment | null>(
    "/worker/next-payment",
    apiDataFetcher(api.worker.nextPayment),
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );
}

export function useWorkerPayouts() {
  return useSWR<PayoutSummary[] | null>(
    "/worker/payouts",
    apiDataFetcher(api.worker.payouts),
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );
}

export function useWorkerDetails() {
  return useSWR<WorkerDetails | null>(
    "/worker/details",
    apiDataFetcher(api.worker.details),
    { refreshInterval: 300_000, revalidateOnFocus: false }
  );
}

export function useWorkerAssets() {
  return useSWR<WorkerAssets | null>(
    "/worker/assets",
    apiDataFetcher(api.worker.assets),
    { refreshInterval: 300_000, revalidateOnFocus: false }
  );
}
