import type { Metadata } from "next";
import VerifyUserView from "@/modules/auth/view/verify-user-view";

export const metadata: Metadata = {
  title: "Verify Account | Upgence - AI Training Data Marketplace",
  description: "Verify your Upgence account to get started.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function Page() {
  return <VerifyUserView />;
}
