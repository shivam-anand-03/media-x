import type { Metadata } from "next";
import { Suspense } from "react";
import { TemplatesView } from "@/modules/studio/views/templates-view";

export const metadata: Metadata = {
  title: "Templates",
  description: "Start your advertisement from a ready-made, fully editable template.",
};

export default function TemplatesPage() {
  // TemplatesView reads search params, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <TemplatesView />
    </Suspense>
  );
}
