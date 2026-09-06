"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { safeParseProjectDocument } from "@workspace/motion";
import { Button } from "@workspace/ui/components/button";
import { useEditorStore } from "../stores/editor-store";
import { useGetProjectQuery } from "../api/studio-api";
import { EditorShell, SmallScreenGate } from "../components/editor/editor-shell";

/**
 * Loads a project into the editor store and mounts the shell.
 *
 * The document is validated on arrival: a project saved by an older schema (or
 * corrupted in transit) surfaces as an explicit error rather than a canvas
 * that silently renders nothing.
 */
export function EditorView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useGetProjectQuery(projectId);
  const [documentError, setDocumentError] = React.useState<string | null>(null);
  const loadedRef = React.useRef<string | null>(null);

  const loadProject = useEditorStore((s) => s.loadProject);
  const resetEditor = useEditorStore((s) => s.resetEditor);

  React.useEffect(() => {
    if (!data) return;
    // Guard against re-loading (and discarding edits) when RTK Query hands back
    // the same project after a background refetch.
    if (loadedRef.current === data.id) return;

    const parsed = safeParseProjectDocument(data.document);
    if (!parsed.success) {
      setDocumentError(
        "This project's contents could not be read. It may have been saved by a newer version of the editor.",
      );
      return;
    }

    loadedRef.current = data.id;
    setDocumentError(null);
    loadProject({
      id: data.id,
      name: data.name,
      document: parsed.data,
      revision: data.revision,
    });
  }, [data, loadProject]);

  // Clear the store on unmount so the next project never sees stale layers.
  React.useEffect(() => () => resetEditor(), [resetEditor]);

  if (isLoading) return <EditorSkeleton />;

  if (isError || documentError) {
    const notFound = isApiStatus(error, 404);
    return (
      <ErrorScreen
        title={notFound ? "Project not found" : "We couldn't open this project"}
        message={
          documentError ??
          (notFound
            ? "It may have been deleted, or the link may be wrong."
            : "Your work is safe on the server — this is a problem loading it. Check your connection and try again.")
        }
        onRetry={notFound ? undefined : () => void refetch()}
        onBack={() => router.push("/dashboard")}
      />
    );
  }

  return (
    <SmallScreenGate>
      <EditorShell />
    </SmallScreenGate>
  );
}

/** Contextual skeleton matching the editor's real layout (§38). */
function EditorSkeleton() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <div className="h-13 shrink-0 animate-pulse border-b border-border bg-card" />
      <div className="flex min-h-0 flex-1">
        <div className="w-14 shrink-0 border-r border-border bg-card" />
        <div className="hidden w-64 shrink-0 animate-pulse border-r border-border bg-card lg:block" />
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="h-[55%] w-[26%] min-w-40 animate-pulse rounded-sm bg-muted/60 ring-1 ring-border/60" />
        </div>
        <div className="hidden w-72 shrink-0 animate-pulse border-l border-border bg-card xl:block" />
      </div>
      <div className="h-56 shrink-0 animate-pulse border-t border-border bg-card" />
    </div>
  );
}

function ErrorScreen({
  title,
  message,
  onRetry,
  onBack,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="size-6" />
        </span>
        <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Button>
          {onRetry && <Button onClick={onRetry}>Try again</Button>}
        </div>
      </div>
    </div>
  );
}

function isApiStatus(error: unknown, status: number): boolean {
  return typeof error === "object" && error !== null && (error as { status?: number }).status === status;
}
