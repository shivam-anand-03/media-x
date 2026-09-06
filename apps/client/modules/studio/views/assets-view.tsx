"use client";

import * as React from "react";
import {
  AlertCircle,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Music4,
  Pause,
  Play,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import type { AssetKind } from "@workspace/motion";
import { formatFileSize } from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { PageHeader, PremiumEmptyState, StatusPill } from "@/components/premium";
import {
  useDeleteAssetMutation,
  useListAssetsQuery,
  type AssetRecord,
} from "../api/studio-api";
import { useAssetUpload } from "../hooks/use-asset-upload";
import { useAudioPreview } from "../hooks/use-audio-preview";

/**
 * The asset library (§39).
 *
 * A single place to manage everything the user has uploaded, independent of any
 * one project. Uploads use the same signed-URL path the editor does.
 */

const FILTERS: { value: AssetKind | "ALL"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "ALL", label: "All", icon: FolderOpen },
  { value: "IMAGE", label: "Images", icon: ImageIcon },
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "AUDIO", label: "Audio", icon: Music4 },
];

export function AssetsView() {
  const [filter, setFilter] = React.useState<AssetKind | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AssetRecord | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { uploads, upload, retry, dismiss } = useAssetUpload();
  const preview = useAudioPreview();
  const [deleteAsset] = useDeleteAssetMutation();

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch } = useListAssetsQuery({
    limit: 100,
    kind: filter === "ALL" ? undefined : filter,
    search: debounced || undefined,
  });

  const assets = data?.items ?? [];

  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer actually leaves the page region.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void upload(Array.from(e.dataTransfer.files));
      }}
    >
      <PageHeader
        eyebrow={
          <>
            <FolderOpen className="size-3" />
            Assets
          </>
        }
        title="Your media library"
        description="Images, video and audio you've uploaded. Everything here is available in the editor."
        actions={
          <Button className="gap-1.5" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            Upload files
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,audio/*"
        onChange={(e) => {
          if (e.target.files?.length) void upload(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {/* ---- Filters ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                filter === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files"
          aria-label="Search assets"
          className="h-9 w-full text-xs sm:w-56"
        />
      </div>

      {/* ---- In-flight uploads ---- */}
      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5"
            >
              {item.status === "error" ? (
                <AlertCircle className="size-4 shrink-0 text-destructive" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {item.filename}
                </span>
                {item.status === "error" ? (
                  <span className="block text-[11px] text-destructive">{item.error}</span>
                ) : (
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${item.progress}%` }}
                    />
                  </span>
                )}
              </span>
              {item.status === "error" && (
                <span className="flex shrink-0 gap-1">
                  <Button size="xs" variant="ghost" onClick={() => retry(item.id)}>
                    Retry
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => dismiss(item.id)}>
                    Dismiss
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---- Grid ---- */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/6 p-8 text-center">
          <AlertCircle className="mx-auto mb-2 size-6 text-destructive" />
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load your assets</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your files are safe — this is only a problem fetching the list.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : assets.length === 0 ? (
        <PremiumEmptyState
          icon={Upload}
          title="No uploaded assets"
          description="Upload images, logos, videos or audio to start creating."
          action={
            <Button className="gap-1.5" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" />
              Upload files
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onDelete={() => setDeleting(asset)}
              playing={preview.playingId === asset.id}
              onTogglePlay={() => preview.toggle(asset.id, asset.url)}
            />
          ))}
        </div>
      )}

      {/* Full-page drop affordance. */}
      {dragging && (
        <div className="pointer-events-none fixed inset-4 z-50 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/8 backdrop-blur-sm">
          <p className="text-sm font-semibold text-primary">Drop files to upload</p>
        </div>
      )}

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.filename}”?</DialogTitle>
            <DialogDescription>
              Projects already using this file will show it as unavailable. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (deleting) await deleteAsset(deleting.id).unwrap();
                setDeleting(null);
              }}
            >
              Delete file
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetCard({
  asset,
  onDelete,
  playing,
  onTogglePlay,
}: {
  asset: AssetRecord;
  onDelete: () => void;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border/70 bg-card transition-all hover:border-primary/35">
      <div className="relative flex aspect-square items-center justify-center bg-muted/40">
        {asset.type === "AUDIO" ? (
          // Audio has no visual, so the tile itself is the play control.
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={asset.status !== "READY"}
            aria-label={playing ? `Stop ${asset.filename}` : `Play ${asset.filename}`}
            className="grid size-full place-items-center transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed"
          >
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full transition-colors",
                playing ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
            </span>
            <Music4 className="absolute right-2 bottom-2 size-3 text-muted-foreground" />
          </button>
        ) : asset.type === "VIDEO" ? (
          <video src={asset.url} muted playsInline className="size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl ?? asset.url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        )}

        {asset.status === "PENDING" && (
          <span className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="size-4 animate-spin text-primary" />
          </span>
        )}

        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Delete ${asset.filename}`}
          onClick={onDelete}
          className="absolute top-1.5 right-1.5 bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="p-2.5">
        <p className="truncate text-[11px] font-medium text-foreground" title={asset.filename}>
          {asset.filename}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {formatFileSize(asset.size)}
          </span>
          {asset.status === "FAILED" && (
            <StatusPill tone="danger" className="px-1.5 py-0 text-[8px]">
              Failed
            </StatusPill>
          )}
        </div>
      </div>
    </article>
  );
}
