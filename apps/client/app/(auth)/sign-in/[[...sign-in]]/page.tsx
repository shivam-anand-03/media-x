import type { Metadata } from "next";
import { SignInView } from "@/modules/auth/view/sign-in-view";

export const metadata: Metadata = {
  title: "Sign In | Upgence - AI Training Data Marketplace",
  description: "Sign in to Upgence to manage your tasks, access shared workspaces, communicate in real time, or track contract milestones.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function Page() {
  return <SignInView />;
}
