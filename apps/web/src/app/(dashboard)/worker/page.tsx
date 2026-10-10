import type { Metadata } from "next";
import WorkerDashboard from "./_components/WorkerDashboard";

export const metadata: Metadata = { title: "Worker Dashboard" };

export default function WorkerDashboardPage() {
  return <WorkerDashboard />;
}
