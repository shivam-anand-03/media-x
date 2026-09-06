import type { Metadata } from "next";
import { AssetsView } from "@/modules/studio/views/assets-view";

export const metadata: Metadata = {
  title: "Assets",
  description: "Manage the images, video and audio in your media library.",
};

export default function AssetsPage() {
  return <AssetsView />;
}
