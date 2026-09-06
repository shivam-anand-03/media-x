import type { Metadata } from "next";
import { DashboardView } from "@/modules/studio/views/dashboard-view";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Your motion graphics advertisement projects.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
