"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  Keyboard,
  Loader2,
  Maximize,
  Play,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { BrandLogo } from "@/components/global/brand-logo";
import { ThemeToggle } from "@/components/global/theme-toggle";
import {
  selectCanRedo,
  selectCanUndo,
  useEditorStore,
} from "../../stores/editor-store";

/**
 * The editor's top bar (§10).
 *
 * The save indicator is a quiet, always-visible status rather than a toast:
 * autosave fires constantly and a notification per save would be unusable.
 */
export function EditorToolbar({
  onSave,
  onPreview,
  onExport,
  onShowShortcuts,
}: {
  onSave: () => void;
  onPreview: () => void;
  onExport: () => void;
  onShowShortcuts: () => void;
}) {
  const router = useRouter();

  const projectName = useEditorStore((s) => s.projectName);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const zoom = useEditorStore((s) => s.zoom);
  const store = useEditorStore.getState;

  return (
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      {/* ---- Left: identity ---- */}
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Back to dashboard"
                onClick={() => {
                  // Flush before navigating so nothing is lost on the way out.
                  onSave();
                  router.push("/dashboard");
                }}
                className="text-muted-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Back to dashboard</TooltipContent>
        </Tooltip>

        <BrandLogo showText={false} size="sm" />

        <ProjectNameField name={projectName} />
        <SaveIndicator onRetry={onSave} />
      </div>

      {/* ---- Centre: history + zoom ---- */}
      <div className="mx-auto flex items-center gap-1">
        <ToolbarButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => store().undo()}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => store().redo()}>
          <Redo2 className="size-4" />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton label="Zoom out" onClick={() => store().setZoom(zoom / 1.2)}>
          <ZoomOut className="size-4" />
        </ToolbarButton>

        <span className="min-w-12 text-center text-[11px] font-medium text-muted-foreground tabular-nums">
          {Math.round(zoom * 100)}%
        </span>

        <ToolbarButton label="Zoom in" onClick={() => store().setZoom(zoom * 1.2)}>
          <ZoomIn className="size-4" />
        </ToolbarButton>

        <ToolbarButton label="Fit to screen (Ctrl+0)" onClick={() => store().setFitToScreen(true)}>
          <Maximize className="size-4" />
        </ToolbarButton>
      </div>

      {/* ---- Right: actions ---- */}
      <div className="flex items-center gap-1.5">
        <ToolbarButton label="Keyboard shortcuts (?)" onClick={onShowShortcuts}>
          <Keyboard className="size-4" />
        </ToolbarButton>

        <ThemeToggle className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />

        <Button size="sm" variant="outline" className="gap-1.5" onClick={onPreview}>
          <Play className="size-3.5" />
          Preview
        </Button>

        <Button size="sm" className="gap-1.5" onClick={onExport}>
          <Download className="size-3.5" />
          Export
        </Button>
      </div>
    </header>
  );
}

/** Editable project title; commits on blur so it can't be lost mid-edit. */
function ProjectNameField({ name }: { name: string }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(name);

  React.useEffect(() => setDraft(name), [name]);

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        aria-label="Project name"
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          useEditorStore.getState().setProjectName(draft.trim() || name);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="h-7 w-48 text-xs font-semibold"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename project"
      className="max-w-56 truncate rounded px-1.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {name}
    </button>
  );
}

/** Quiet save status (§10, §26). */
function SaveIndicator({ onRetry }: { onRetry: () => void }) {
  const saveState = useEditorStore((s) => s.saveState);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const saveError = useEditorStore((s) => s.saveError);

  // Re-render every 30s so "Saved 2 minutes ago" stays honest.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const timer = setInterval(force, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (saveState === "error") {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1">
        <AlertTriangle className="size-3 shrink-0 text-destructive" />
        <span className="text-[11px] font-medium text-destructive" title={saveError ?? undefined}>
          Unable to save
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="text-[11px] font-semibold text-destructive underline underline-offset-2 hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  if (saveState === "offline") {
    return (
      <StatusText icon={<CloudOff className="size-3" />} tone="warning">
        Offline · changes kept locally
      </StatusText>
    );
  }

  if (saveState === "saving") {
    return (
      <StatusText icon={<Loader2 className="size-3 animate-spin" />}>Saving…</StatusText>
    );
  }

  if (saveState === "dirty") {
    return <StatusText>Unsaved changes</StatusText>;
  }

  if (saveState === "saved") {
    return (
      <StatusText icon={<Check className="size-3" />} tone="success">
        {lastSavedAt && Date.now() - lastSavedAt > 60_000
          ? `Saved ${Math.round((Date.now() - lastSavedAt) / 60_000)}m ago`
          : "Saved"}
      </StatusText>
    );
  }

  return null;
}

function StatusText({
  icon,
  tone = "muted",
  children,
}: {
  icon?: React.ReactNode;
  tone?: "muted" | "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 px-1.5 text-[11px] font-medium",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            className="text-muted-foreground"
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
