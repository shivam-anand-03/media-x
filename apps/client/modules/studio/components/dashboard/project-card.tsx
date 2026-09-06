"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Copy,
  Film,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { describeCanvas, formatTimecode } from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { StatusPill } from "@/components/premium";
import type { ProjectSummary } from "../../api/studio-api";

/**
 * A project card (§6).
 *
 * The thumbnail is a real poster frame captured from the editor on save; when
 * a project has never been opened long enough to produce one, it falls back to
 * a deterministic gradient derived from the project id — so the grid still
 * reads as a set of distinct things rather than a wall of identical
 * placeholders.
 */

const STATUS_TONE = {
  DRAFT: { tone: "neutral" as const, label: "Draft" },
  READY: { tone: "info" as const, label: "Ready" },
  EXPORTED: { tone: "success" as const, label: "Exported" },
  ARCHIVED: { tone: "neutral" as const, label: "Archived" },
};

export function ProjectCard({
  project,
  onDelete,
  onDuplicate,
  onRename,
}: {
  project: ProjectSummary;
  onDelete: (project: ProjectSummary) => void;
  onDuplicate: (project: ProjectSummary) => void;
  onRename: (project: ProjectSummary) => void;
}) {
  const router = useRouter();
  const status = STATUS_TONE[project.status];
  const portrait = project.height > project.width;

  const open = () => router.push(`/editor/${project.id}`);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/35",
        "hover:shadow-[0_2px_4px_color-mix(in_oklab,var(--foreground)_5%,transparent),0_18px_40px_-20px_color-mix(in_oklab,var(--primary)_40%,transparent)]",
      )}
    >
      {/* Thumbnail. The whole tile is the primary click target. */}
      <button
        type="button"
        onClick={open}
        aria-label={`Open ${project.name}`}
        className="relative block w-full overflow-hidden bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex aspect-video items-center justify-center">
          {project.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnail}
              alt=""
              loading="lazy"
              className={cn(
                "transition-transform duration-500 group-hover:scale-[1.03]",
                portrait ? "h-full w-auto" : "w-full",
              )}
            />
          ) : (
            <span
              className="flex size-full items-center justify-center"
              style={{ background: fallbackGradient(project.id) }}
            >
              <Film className="size-6 text-white/60" />
            </span>
          )}
        </span>

        {/* Format badge sits over the artwork. */}
        <span className="absolute top-2 left-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-foreground backdrop-blur-sm">
          {describeCanvas(project.width, project.height)}
        </span>

        <span className="absolute right-2 bottom-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold text-foreground tabular-nums backdrop-blur-sm">
          {formatTimecode(project.duration)}
        </span>
      </button>

      {/* Meta */}
      <div className="flex min-w-0 items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground" title={project.name}>
            {project.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            <span className="truncate">Edited {relativeTime(project.updatedAt)}</span>
          </p>
        </div>

        <StatusPill tone={status.tone} className="mt-0.5 shrink-0">
          {status.label}
        </StatusPill>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Actions for ${project.name}`}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={open}>
              <Pencil className="size-3.5" />
              Open in editor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(project)}>
              <Pencil className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(project)}>
              <Copy className="size-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

/**
 * A stable gradient per project. Hashing the id means a given project always
 * gets the same colours, so the grid stays recognisable between visits.
 */
function fallbackGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `linear-gradient(135deg, oklch(0.45 0.16 ${hue}), oklch(0.2 0.06 ${(hue + 40) % 360}))`;
}

/** "12 minutes ago" style stamp. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "recently";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Loading placeholder that matches the card's real proportions (§38). */
export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="aspect-video animate-pulse bg-muted/60" />
      <div className="space-y-2 p-3">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/40" />
      </div>
    </div>
  );
}
