import type { Metadata } from "next";
import { EditorView } from "@/modules/studio/views/editor-view";

export const metadata: Metadata = {
  title: "Editor",
  // The editor is a workspace, not a document to index.
  robots: { index: false, follow: false },
};

export default async function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <EditorView projectId={projectId} />;
}
