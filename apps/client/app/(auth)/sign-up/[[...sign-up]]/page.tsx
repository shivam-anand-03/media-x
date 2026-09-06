import { type Metadata } from "next";
import { SignUpView } from "@/modules/auth/view/sign-up-view";

export const metadata: Metadata = {
  title: "Sign Up | Upgence - AI Training Data Marketplace",
  description: "Join Upgence as a client to source high-quality AI training data or register as a verified expert contributor for annotation, RLHF, and red-teaming tasks.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function Page() {
  return <SignUpView />;
}
