import type { Metadata } from "next";
import ManagerDashboard from "./_components/ManagerDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function ManagerDashboardPage() {
  return <ManagerDashboard />;
}
