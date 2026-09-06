"use client";

import * as React from "react";
import {
  ArrowRight,
  Loader2,
  Minus,
  Music4,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Square,
  Star,
  Triangle,
  Upload,
} from "lucide-react";
import {
  CANVAS_PRESETS,
  DECORATIVE_PRESETS,
  ICON_LIBRARY,
  SHAPE_PRESETS,
  TYPOGRAPHY_PRESETS,
  createGradientLayer,
  createIconLayer,
  createMediaLayer,
  createShapeLayer,
  createTextLayer,
  createId,
  nextZIndex,
  type Layer,
  type LayerFactoryContext,
} from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PremiumEmptyState } from "@/components/premium";
import { getIconComponent } from "@workspace/renderer/preview";
import { useEditorStore } from "../../stores/editor-store";
import { useListTemplatesQuery, useListAssetsQuery, type AssetRecord } from "../../api/studio-api";
import { useAssetUpload } from "../../hooks/use-asset-upload";
import { useAudioPreview } from "../../hooks/use-audio-preview";

/**
 * The contextual tool panels behind the left rail (§11–§14).
 *
 * Everything here funnels through `insertLayer`, which places the new layer at
 * the current playhead with a sensible default duration — so an element added
 * while scrubbed to 4s appears at 4s, not at the start.
 */

/** Builds the placement context for a new layer. */
function useInsertLayer() {
  return React.useCallback((build: (ctx: LayerFactoryContext) => Layer) => {
    const state = useEditorStore.getState();
    const doc = state.document;
    if (!doc) return;

    const startTime = Math.min(state.currentTime, Math.max(0, doc.canvas.duration - 1));
    const ctx: LayerFactoryContext = {
      canvasWidth: doc.canvas.width,
      canvasHeight: doc.canvas.height,
      startTime: Math.round(startTime * 100) / 100,
      // Run to the end of the project by default, but never shorter than 1s.
      duration: Math.max(1, Math.round((doc.canvas.duration - startTime) * 100) / 100),
      zIndex: nextZIndex(doc.layers),
      id: createId("ly"),
    };

    state.addLayer(build(ctx));
  }, []);
}

function PanelShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border/70 px-4 py-3">
        <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function TextPanel() {
  const insert = useInsertLayer();

  return (
    <PanelShell title="Text" description="Click a style to add it to the canvas.">
      <div className="space-y-2">
        {TYPOGRAPHY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() =>
              insert((ctx) => createTextLayer(ctx, preset.id, DEFAULT_TEXT[preset.id] ?? preset.label))
            }
            className={cn(
              "group flex w-full flex-col gap-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-left transition-all",
              "hover:border-primary/40 hover:bg-muted/60",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <span
              className="truncate text-foreground"
              style={{
                fontSize: PREVIEW_SIZE[preset.id],
                fontWeight: preset.properties.fontWeight,
                letterSpacing: preset.id === "caption" ? "0.14em" : undefined,
                textTransform: preset.properties.textTransform === "uppercase" ? "uppercase" : undefined,
              }}
            >
              {DEFAULT_TEXT[preset.id] ?? preset.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{preset.description}</span>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

const DEFAULT_TEXT: Record<string, string | undefined> = {
  heading: "Your headline",
  subheading: "Supporting line",
  body: "Describe your offer in a sentence or two.",
  caption: "Label",
  cta: "Get Started",
};

const PREVIEW_SIZE: Record<string, number | undefined> = {
  heading: 22,
  subheading: 16,
  body: 13,
  caption: 11,
  cta: 13,
};

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const SHAPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  rectangle: Square,
  roundedRect: Square,
  circle: Sparkles,
  triangle: Triangle,
  star: Star,
  line: Minus,
  arrow: ArrowRight,
};

export function ElementsPanel() {
  const insert = useInsertLayer();
  const [iconQuery, setIconQuery] = React.useState("");

  const icons = React.useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    return q ? ICON_LIBRARY.filter((name) => name.includes(q)) : ICON_LIBRARY;
  }, [iconQuery]);

  return (
    <PanelShell title="Elements" description="Shapes, decorative gradients and icons.">
      <div className="space-y-6">
        <div>
          <GroupLabel>Shapes</GroupLabel>
          <div className="grid grid-cols-3 gap-2">
            {SHAPE_PRESETS.map((preset) => {
              const Icon = SHAPE_ICON[preset.id] ?? Square;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => insert((ctx) => createShapeLayer(ctx, preset.id))}
                  className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 transition-all hover:border-primary/40 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ShapeGlyph kind={preset.id} fill={preset.properties.fill} />
                  <span className="text-[9px] text-muted-foreground">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <GroupLabel>Decorative</GroupLabel>
          <div className="grid grid-cols-3 gap-2">
            {DECORATIVE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                onClick={() => insert((ctx) => createGradientLayer(ctx, preset.id))}
                className="group aspect-square overflow-hidden rounded-lg border border-border/70 transition-all hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  className="block size-full"
                  style={{
                    background:
                      preset.kind === "linear"
                        ? `linear-gradient(135deg, ${preset.from}, ${preset.to})`
                        : `radial-gradient(circle at 50% 50%, ${preset.from}, ${preset.to})`,
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <GroupLabel>Icons</GroupLabel>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search icons"
              aria-label="Search icons"
              className="h-8 pl-8 text-xs"
            />
          </div>

          {icons.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              No icons match “{iconQuery}”.
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              {icons.map((name) => {
                const Icon = getIconComponent(name);
                return (
                  <button
                    key={name}
                    type="button"
                    title={name.replace(/-/g, " ")}
                    aria-label={`Add ${name.replace(/-/g, " ")} icon`}
                    onClick={() => insert((ctx) => createIconLayer(ctx, name))}
                    className="grid aspect-square place-items-center rounded-lg border border-border/70 bg-muted/30 text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function ShapeGlyph({ kind, fill }: { kind: string; fill: string }) {
  const base = "block";
  switch (kind) {
    case "circle":
      return <span className={cn(base, "size-6 rounded-full")} style={{ background: fill }} />;
    case "roundedRect":
      return <span className={cn(base, "h-5 w-7 rounded-[6px]")} style={{ background: fill }} />;
    case "line":
      return <span className={cn(base, "h-0.5 w-7 rounded-full")} style={{ background: fill }} />;
    case "triangle":
      return (
        <svg viewBox="0 0 24 24" className="size-6">
          <polygon points="12,3 22,21 2,21" fill={fill} />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" className="size-6">
          <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill={fill} />
        </svg>
      );
    case "arrow":
      return (
        <svg viewBox="0 0 24 12" className="h-3 w-7">
          <polygon points="0,4 16,4 16,1 24,6 16,11 16,8 0,8" fill={fill} />
        </svg>
      );
    default:
      return <span className={cn(base, "h-5 w-7 rounded-[2px]")} style={{ background: fill }} />;
  }
}

// ---------------------------------------------------------------------------
// Media / uploads
// ---------------------------------------------------------------------------

export function MediaPanel({ kind }: { kind: "media" | "uploads" }) {
  const insert = useInsertLayer();
  const projectId = useEditorStore((s) => s.projectId);
  const { uploads, upload, retry, dismiss } = useAssetUpload(projectId ?? undefined);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useListAssetsQuery({ limit: 60 });
  const assets = data?.items ?? [];

  const visibleAssets =
    kind === "media" ? assets.filter((a) => a.type !== "AUDIO") : assets;

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void upload(Array.from(files));
  };

  const addToCanvas = (asset: AssetRecord) => {
    if (asset.status !== "READY") return;
    insert((ctx) =>
      createMediaLayer(
        ctx,
        asset.type === "VIDEO" ? "video" : "image",
        asset.url,
        asset.filename.replace(/\.[^.]+$/, ""),
        asset.metadata.width && asset.metadata.height
          ? { width: asset.metadata.width, height: asset.metadata.height }
          : undefined,
      ),
    );
  };

  return (
    <PanelShell
      title={kind === "media" ? "Media" : "Uploads"}
      description="Drop images, video or audio, then click to place them."
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors",
            dragging ? "border-primary bg-primary/8" : "border-border bg-muted/25",
          )}
        >
          <Upload className={cn("mx-auto mb-2 size-5", dragging ? "text-primary" : "text-muted-foreground")} />
          <p className="text-[11px] font-medium text-foreground">Drag &amp; drop files here</p>
          <p className="mt-0.5 mb-3 text-[10px] text-muted-foreground">or</p>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => inputRef.current?.click()}>
            Upload files
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,audio/*"
            onChange={(e) => {
              onFiles(e.target.files);
              // Reset so re-picking the same file still fires a change event.
              e.target.value = "";
            }}
          />
        </div>

        {uploads.length > 0 && (
          <div className="space-y-2">
            <GroupLabel>Uploading</GroupLabel>
            {uploads.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {item.status === "error" ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                  ) : (
                    <Loader2 className="size-3 shrink-0 animate-spin text-primary" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                    {item.filename}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {item.status === "error" ? "Failed" : `${item.progress}%`}
                  </span>
                </div>

                {item.status === "error" ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[10px] text-destructive">{item.error}</p>
                    <Button size="xs" variant="ghost" className="h-5 text-[10px]" onClick={() => retry(item.id)}>
                      Retry
                    </Button>
                    <Button size="xs" variant="ghost" className="h-5 text-[10px]" onClick={() => dismiss(item.id)}>
                      Dismiss
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <GroupLabel>Your library</GroupLabel>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-center">
              <p className="text-[11px] text-destructive">Couldn&apos;t load your library.</p>
              <Button size="xs" variant="ghost" className="mt-1.5 text-[10px]" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : visibleAssets.length === 0 ? (
            <PremiumEmptyState
              quiet
              icon={Upload}
              title="No uploads yet"
              description="Upload images, logos, video or audio to start creating."
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {visibleAssets.map((asset) => (
                <AssetTile key={asset.id} asset={asset} onClick={() => addToCanvas(asset)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function AssetTile({ asset, onClick }: { asset: AssetRecord; onClick: () => void }) {
  const pending = asset.status === "PENDING";
  const failed = asset.status === "FAILED";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={asset.status !== "READY"}
      title={asset.filename}
      aria-label={`Add ${asset.filename} to canvas`}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted/40 transition-all",
        asset.status === "READY" && "hover:border-primary/40 hover:ring-2 hover:ring-primary/20",
        asset.status !== "READY" && "cursor-not-allowed opacity-60",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      {asset.type === "AUDIO" ? (
        <span className="grid size-full place-items-center">
          <Music4 className="size-5 text-muted-foreground" />
        </span>
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

      {pending && (
        <span className="absolute inset-0 grid place-items-center bg-background/70">
          <Loader2 className="size-4 animate-spin text-primary" />
        </span>
      )}
      {failed && (
        <span className="absolute inset-x-0 bottom-0 bg-destructive/85 py-0.5 text-[9px] font-semibold text-white">
          Failed
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export function AudioPanel() {
  const projectId = useEditorStore((s) => s.projectId);
  const { uploads, upload } = useAssetUpload(projectId ?? undefined);
  const preview = useAudioPreview();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useListAssetsQuery({ kind: "AUDIO", limit: 60 });
  const tracks = data?.items ?? [];

  // Auditioning and timeline playback would otherwise talk over each other.
  const timelinePlaying = useEditorStore((s) => s.isPlaying);
  const stopPreview = preview.stop;
  React.useEffect(() => {
    if (timelinePlaying) stopPreview();
  }, [timelinePlaying, stopPreview]);

  // Audition a file the moment its upload lands, so you hear what you just
  // added instead of having to put it on the timeline to find out.
  const auditioned = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    for (const item of uploads) {
      if (item.status !== "done" || !item.asset || auditioned.current.has(item.id)) continue;
      auditioned.current.add(item.id);
      if (item.asset.type === "AUDIO") preview.toggle(item.asset.id, item.asset.url);
    }
  }, [uploads, preview]);

  const addTrack = (asset: AssetRecord) => {
    const state = useEditorStore.getState();
    const doc = state.document;
    if (!doc || asset.status !== "READY") return;

    const startTime = Math.min(state.currentTime, Math.max(0, doc.canvas.duration - 0.5));
    const available = doc.canvas.duration - startTime;
    // Use the file's real length when we know it, capped by what's left.
    const duration = Math.max(0.5, Math.min(asset.metadata.duration ?? available, available));

    state.addAudioTrack({
      id: createId("aud"),
      name: asset.filename.replace(/\.[^.]+$/, ""),
      src: asset.url,
      kind: "music",
      startTime: Math.round(startTime * 100) / 100,
      duration: Math.round(duration * 100) / 100,
      trimStart: 0,
      volume: 0.8,
      fadeIn: 0,
      fadeOut: Math.min(1, duration / 4),
      muted: false,
      locked: false,
    });
  };

  return (
    <PanelShell title="Audio" description="Add music, voiceover or sound effects.">
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Upload audio
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept="audio/*"
          onChange={(e) => {
            if (e.target.files?.length) void upload(Array.from(e.target.files));
            e.target.value = "";
          }}
        />

        {uploads.filter((u) => u.status !== "error").length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Uploading {uploads.filter((u) => u.status !== "error").length} file(s)…
          </p>
        )}

        <div>
          <GroupLabel>Your audio</GroupLabel>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <PremiumEmptyState
              quiet
              icon={Music4}
              title="No audio yet"
              description="Upload an MP3 or WAV to score your advertisement."
              className="py-8"
            />
          ) : (
            <ul className="space-y-1.5">
              {tracks.map((asset) => {
                const playing = preview.playingId === asset.id;
                const ready = asset.status === "READY";
                return (
                  <li
                    key={asset.id}
                    className={cn(
                      "group relative flex items-center gap-2 overflow-hidden rounded-lg border bg-muted/30 pr-1.5 pl-2 transition-colors",
                      playing ? "border-primary/50 bg-primary/8" : "border-border/70 hover:bg-muted/60",
                      !ready && "opacity-60",
                    )}
                  >
                    {/* Preview — hear it before committing it to the timeline. */}
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => preview.toggle(asset.id, asset.url)}
                      aria-label={playing ? `Stop ${asset.filename}` : `Play ${asset.filename}`}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        playing
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                        !ready && "cursor-not-allowed",
                      )}
                    >
                      {asset.status === "PENDING" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : playing ? (
                        <Pause className="size-3" />
                      ) : (
                        <Play className="size-3 translate-x-px" />
                      )}
                    </button>

                    <span className="min-w-0 flex-1 py-2.5">
                      <span className="block truncate text-[11px] font-medium text-foreground">
                        {asset.filename}
                      </span>
                      <span className="block text-[10px] text-muted-foreground tabular-nums">
                        {playing
                          ? "Playing…"
                          : asset.metadata.duration
                            ? formatDuration(asset.metadata.duration)
                            : "Audio"}
                      </span>
                    </span>

                    {/* Add to timeline. */}
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => addTrack(asset)}
                      aria-label={`Add ${asset.filename} to the timeline`}
                      title="Add to timeline"
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors",
                        "hover:bg-primary/12 hover:text-primary",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        !ready && "cursor-not-allowed",
                      )}
                    >
                      <Plus className="size-3.5" />
                    </button>

                    {/* Progress hairline while auditioning. */}
                    {playing && (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width] duration-200"
                        style={{ width: `${preview.progress * 100}%` }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function TemplatesPanel() {
  const { data, isLoading } = useListTemplatesQuery();
  const templates = data?.items ?? [];

  return (
    <PanelShell
      title="Templates"
      description="Applying a template replaces the current canvas. Undo restores it."
    >
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {templates.map((template) => (
            <li key={template.id}>
              <TemplateCard slug={template.slug} name={template.name} accent={template.accent} duration={template.duration} sceneCount={template.sceneCount} />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function TemplateCard({
  slug,
  name,
  accent,
  duration,
  sceneCount,
}: {
  slug: string;
  name: string;
  accent: string[];
  duration: number;
  sceneCount: number;
}) {
  const [applying, setApplying] = React.useState(false);

  const apply = async () => {
    setApplying(true);
    try {
      // Fetched on demand: the list endpoint omits documents so the panel
      // isn't downloading ten full projects to render ten cards.
      const base = process.env.NEXT_PUBLIC_WEB_SERVER_URL;
      const response = await fetch(`${base}/templates/${slug}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load template");
      const payload = (await response.json()) as { data?: { projectData?: unknown } };
      const document = payload.data?.projectData;
      if (!document) throw new Error("Template has no document");

      const { parseProjectDocument } = await import("@workspace/motion");
      const state = useEditorStore.getState();
      const parsed = parseProjectDocument(document);
      // Keep the project's own canvas; only the content comes from the template.
      const current = state.document;
      state.replaceDocument(
        current ? { ...parsed, canvas: { ...parsed.canvas, ...current.canvas } } : parsed,
      );
    } catch {
      // Surfaced by the panel's own state rather than a toast, per §10.
    } finally {
      setApplying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void apply()}
      disabled={applying}
      className="group w-full overflow-hidden rounded-lg border border-border/70 text-left transition-all hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className="flex h-20 items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${accent[0] ?? "#7c3aed"}, ${accent[1] ?? "#05030c"})` }}
      >
        {applying ? (
          <Loader2 className="size-4 animate-spin text-white" />
        ) : (
          <span className="text-[10px] font-bold tracking-[0.16em] text-white/85 uppercase">
            {sceneCount} scenes
          </span>
        )}
      </span>
      <span className="block px-3 py-2">
        <span className="block truncate text-[11px] font-semibold text-foreground">{name}</span>
        <span className="block text-[10px] text-muted-foreground tabular-nums">{duration}s</span>
      </span>
    </button>
  );
}
