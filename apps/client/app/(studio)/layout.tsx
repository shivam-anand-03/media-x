import type { Metadata } from "next";
import { StudioNav } from "@/modules/studio/components/studio-nav";

export const metadata: Metadata = {
  title: "Workspace",
};

/**
 * Shell for the non-editor studio pages (dashboard, templates, assets).
 * The editor lives outside this group because it owns the full viewport.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <StudioNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
