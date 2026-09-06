"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  Film,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import {
  QUALITY_SETTINGS,
  STAGE_LABELS,
  canRetry,
  estimateRenderSeconds,
  formatFileSize,
  friendlyExportError,
  isActive,
  resolveOutputSize,
  type ExportFormat,
  type ExportQuality,
  type ProjectDocument,
  type RenderStage,
} from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { SegmentedField } from "../inspector/controls";
import { useExportJob } from "../../hooks/use-export-job";

/**
 * The export workflow (§29–§31).
 *
 * Three states in one dialog: configure, watch progress, then collect the
 * result. Failure shows a plain-language reason plus a real retry — never a
 * stack trace.
 */
export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  document: doc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  document: ProjectDocument | null;
}) {
  const [format, setFormat] = React.useState<ExportFormat>("mp4");
  const [quality, setQuality] = React.useState<ExportQuality>("high");

  const { job, start, retry, cancel, reset, starting, error } = useExportJob(projectId);

  // Clear a finished job when the dialog is dismissed, so reopening starts
  // fresh rather than showing last time's result.
  React.useEffect(() => {
    if (!open && job && !isActive(job.status)) reset();
  }, [open, job, reset]);

  if (!doc) return null;

  const output = resolveOutputSize(doc, quality);
  const busy = Boolean(job && isActive(job.status));

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export advertisement</DialogTitle>
          {!job && (
            <DialogDescription>
              Rendering happens on the server — you can keep editing while it runs.
            </DialogDescription>
          )}
        </DialogHeader>

        {!job ? (
          <ConfigureStep
            doc={doc}
            format={format}
            quality={quality}
            output={output}
            starting={starting}
            error={error}
            onFormat={setFormat}
            onQuality={setQuality}
            onStart={() => void start({ format, quality })}
          />
        ) : job.status === "COMPLETED" ? (
          <CompletedStep job={job} onClose={() => onOpenChange(false)} onNew={reset} />
        ) : canRetry(job.status) ? (
          <FailedStep
            reason={friendlyExportError(job.error ?? undefined)}
            cancelled={job.status === "CANCELLED"}
            onRetry={() => void retry()}
            onBack={() => onOpenChange(false)}
          />
        ) : (
          <ProgressStep
            progress={job.progress}
            stage={job.stage}
            onCancel={() => void cancel()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfigureStep({
  doc,
  format,
  quality,
  output,
  starting,
  error,
  onFormat,
  onQuality,
  onStart,
}: {
  doc: ProjectDocument;
  format: ExportFormat;
  quality: ExportQuality;
  output: { width: number; height: number };
  starting: boolean;
  error: string | null;
  onFormat: (value: ExportFormat) => void;
  onQuality: (value: ExportQuality) => void;
  onStart: () => void;
}) {
  const estimate = estimateRenderSeconds(doc, quality);
  const empty = doc.layers.length === 0;

  return (
    <div className="space-y-4">
      <SegmentedField
        label="Format"
        value={format}
        onChange={onFormat}
        options={[
          { value: "mp4", label: "MP4" },
          { value: "webm", label: "WebM" },
          { value: "gif", label: "GIF" },
        ]}
      />

      <div className="space-y-1.5">
        <span className="block text-[11px] font-medium text-muted-foreground">Quality</span>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(QUALITY_SETTINGS) as ExportQuality[]).map((option) => {
            const setting = QUALITY_SETTINGS[option];
            const active = option === quality;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onQuality(option)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-all",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary/8 ring-1 ring-primary/25"
                    : "border-border/70 hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <span className={cn("block text-xs font-semibold", active ? "text-primary" : "text-foreground")}>
                  {setting.label}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{setting.note}</span>
              </button>
            );
          })}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-center">
        <Summary label="Resolution" value={`${output.width}×${output.height}`} />
        <Summary label="Frame rate" value={`${doc.canvas.fps} fps`} />
        <Summary label="Duration" value={`${doc.canvas.duration.toFixed(1)}s`} />
      </dl>

      <p className="text-[11px] text-muted-foreground">
        Estimated render time: about {estimate < 60 ? `${estimate} seconds` : `${Math.round(estimate / 60)} minutes`}.
      </p>

      {empty && (
        <p className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
          Add at least one element to your advertisement before exporting.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <Button onClick={onStart} disabled={starting || empty} className="w-full gap-1.5">
        {starting ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
        {starting ? "Starting…" : "Export video"}
      </Button>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function ProgressStep({
  progress,
  stage,
  onCancel,
}: {
  progress: number;
  stage?: RenderStage | null;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          {stage ? STAGE_LABELS[stage] : "Preparing video…"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          You can close this dialog — the render continues on the server.
        </p>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-linear-to-r from-primary to-brand-pink transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(2, progress)}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-1.5 text-center text-[11px] font-semibold text-foreground tabular-nums">
          {progress}%
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={onCancel} className="w-full gap-1.5 text-muted-foreground">
        <X className="size-3.5" />
        Cancel export
      </Button>
    </div>
  );
}

function CompletedStep({
  job,
  onClose,
  onNew,
}: {
  job: { outputUrl?: string | null; fileSize?: number | null; format: ExportFormat };
  onClose: () => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4 py-2 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/12 text-success">
        <Check className="size-6" />
      </span>

      <div>
        <p className="text-sm font-semibold text-foreground">Export complete</p>
        {job.fileSize && (
          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
            {formatFileSize(job.fileSize)} · {job.format.toUpperCase()}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 gap-1.5"
          disabled={!job.outputUrl}
          onClick={() => job.outputUrl && window.open(job.outputUrl, "_blank", "noopener")}
        >
          <ExternalLink className="size-3.5" />
          Preview
        </Button>
        <Button
          className="flex-1 gap-1.5"
          disabled={!job.outputUrl}
          // `download` on a cross-origin URL is ignored by browsers, so this
          // opens the file; the user saves from there.
          onClick={() => job.outputUrl && window.open(job.outputUrl, "_blank", "noopener")}
        >
          <Download className="size-3.5" />
          Download
        </Button>
      </div>

      <div className="flex justify-center gap-3 text-[11px]">
        <button type="button" onClick={onNew} className="text-primary hover:underline">
          Export again
        </button>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:underline">
          Back to editor
        </button>
      </div>
    </div>
  );
}

function FailedStep({
  reason,
  cancelled,
  onRetry,
  onBack,
}: {
  reason: string;
  cancelled: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="text-center">
        <span
          className={cn(
            "mx-auto grid size-12 place-items-center rounded-full",
            cancelled ? "bg-muted text-muted-foreground" : "bg-destructive/12 text-destructive",
          )}
        >
          {cancelled ? <X className="size-6" /> : <AlertTriangle className="size-6" />}
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">
          {cancelled ? "Export cancelled" : "Export failed"}
        </p>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
        <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          {cancelled ? "What happened" : "Reason"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{reason}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Your project is saved and unchanged.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onBack}>
          Back to editor
        </Button>
        <Button className="flex-1 gap-1.5" onClick={onRetry}>
          <RotateCcw className="size-3.5" />
          Retry export
        </Button>
      </div>
    </div>
  );
}
