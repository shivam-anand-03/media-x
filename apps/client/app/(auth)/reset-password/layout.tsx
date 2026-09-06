import type { Metadata } from "next";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reset Password | Upgence - AI Training Data Marketplace",
  description: "Create a new password for your Upgence account.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
