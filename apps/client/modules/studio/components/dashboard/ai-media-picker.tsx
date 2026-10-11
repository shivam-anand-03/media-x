"use client";

import * as React from "react";
import { AlertCircle, Film, ImagePlus, Loader2, Music, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetRecord } from "../../api/studio-api";
import { useAssetUpload } from "../../hooks/use-asset-upload";

/**
 * Media for an AI generation: one background (image or video) and one audio track.
 *
 * Files upload as soon as they are picked, through the same signed flow as the
 * asset library, so by the time the user presses Generate the server only
 * needs the asset ids. The image — or frames from the video — is shown to the
 * model and becomes the background; the audio is laid under the whole short.
 */

export interface AiMedia {
  background?: AssetRecord;
  audio?: AssetRecord;
}

type Slot = "background" | "audio";

interface SlotState {
  file?: File;
  previewUrl?: string;
  error?: string;
}

export function AiMediaPicker({
  value,
  onChange,
  onBusyChange,
  disabled,
}: {
  value: AiMedia;
  onChange: (next: AiMedia) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const { uploads, upload } = useAssetUpload();
  const [slots, setSlots] = React.useState<Record<Slot, SlotState>>({ background: {}, audio: {} });
  const valueRef = React.useRef(value);
  valueRef.current = value;
  // `upload` resolves after state settles; read the latest list through a ref.
  const uploadsRef = React.useRef(uploads);
  uploadsRef.current = uploads;

  const busy = uploads.some((u) => u.status !== "done" && u.status !== "error");
  React.useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  // Object URLs are revoked when replaced or on unmount.
  const previews = React.useRef<string[]>([]);
  React.useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const pick = async (slot: Slot, file: File | undefined) => {
    if (!file) return;
    const accepted =
      slot === "background"
        ? file.type.startsWith("image/") || file.type.startsWith("video/")
        : file.type.startsWith("audio/");
    if (!accepted) {
      setSlots((s) => ({ ...s, [slot]: { error: slot === "background" ? "Choose an image or video." : "Choose an audio file." } }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    previews.current.push(previewUrl);
    setSlots((s) => ({ ...s, [slot]: { file, previewUrl } }));
    onChange({ ...valueRef.current, [slot]: undefined });

    const [asset] = await upload([file]);
    if (asset) {
      onChange({ ...valueRef.current, [slot]: asset });
    } else {
      const failed = uploadsRef.current.find((u) => u.file === file);
      setSlots((s) => ({ ...s, [slot]: { error: failed?.error ?? "Upload failed. Try again." } }));
    }
  };

  const clear = (slot: Slot) => {
    setSlots((s) => ({ ...s, [slot]: {} }));
    onChange({ ...valueRef.current, [slot]: undefined });
  };

  const progressOf = (slot: Slot) => {
    const file = slots[slot].file;
    const item = file ? uploads.find((u) => u.file === file) : undefined;
    return item && item.status !== "done" && item.status !== "error" ? item.progress : null;
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium">
        Media <span className="font-normal text-muted-foreground">(optional)</span>
      </span>
      <div className="grid grid-cols-2 gap-2">
        <BackgroundSlot
          asset={value.background}
          state={slots.background}
          progress={progressOf("background")}
          disabled={disabled}
          onPick={(file) => void pick("background", file)}
          onClear={() => clear("background")}
        />
        <AudioSlot
          asset={value.audio}
          state={slots.audio}
          progress={progressOf("audio")}
          disabled={disabled}
          onPick={(file) => void pick("audio", file)}
          onClear={() => clear("audio")}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        The AI looks at your image or video to write the copy and uses it as the background.
        Audio plays under the whole short.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DropTile({
  accept,
  disabled,
  onPick,
  children,
  className,
  label,
}: {
  accept: string;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onPick(e.dataTransfer.files[0]);
      }}
      className={cn(
        "relative flex h-24 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-border text-center transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        over ? "border-primary bg-primary/8" : "hover:border-primary/40 hover:bg-muted/40",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {children}
    </div>
  );
}

function ClearButton({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      className="absolute top-1.5 right-1.5 z-10 grid size-5 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
    >
      <X className="size-3" />
    </button>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/30">
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}

function SlotError({ message }: { message: string }) {
  return (
    <span className="flex items-center gap-1 px-2 text-[10px] text-destructive">
      <AlertCircle className="size-3 shrink-0" />
      {message}
    </span>
  );
}

function BackgroundSlot({
  asset,
  state,
  progress,
  disabled,
  onPick,
  onClear,
}: {
  asset?: AssetRecord;
  state: SlotState;
  progress: number | null;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const src = state.previewUrl ?? asset?.url;
  const isVideo = (state.file?.type ?? asset?.mimeType ?? "").startsWith("video/");
  const duration = asset?.metadata.duration;
  const Icon = isVideo ? Film : ImagePlus;

  return (
    <DropTile accept="image/*,video/*" disabled={disabled} onPick={onPick} label="Choose a background image or video">
      {src ? (
        <>
          {isVideo ? (
            <video src={src} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <span className="absolute bottom-1.5 left-2 z-[1] flex items-center gap-1 text-[10px] font-medium text-white">
            {progress !== null ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}
            {progress !== null
              ? "Uploading…"
              : isVideo
                ? `Background video${duration ? ` · ${Math.round(duration)}s` : ""}`
                : "Background image"}
          </span>
          {!disabled && <ClearButton onClear={onClear} label="Remove background" />}
          {progress !== null && <Progress value={progress} />}
        </>
      ) : (
        <>
          <span className="flex items-center gap-1 text-muted-foreground">
            <ImagePlus className="size-4" />
            <Film className="size-4" />
          </span>
          <span className="text-[11px] font-medium">Background image or video</span>
          {state.error ? <SlotError message={state.error} /> : <span className="text-[10px] text-muted-foreground">Drop or click</span>}
        </>
      )}
    </DropTile>
  );
}

function AudioSlot({
  asset,
  state,
  progress,
  disabled,
  onPick,
  onClear,
}: {
  asset?: AssetRecord;
  state: SlotState;
  progress: number | null;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const src = state.previewUrl ?? asset?.url;
  const name = state.file?.name ?? asset?.filename;
  const duration = asset?.metadata.duration;

  React.useEffect(() => setPlaying(false), [src]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <DropTile accept="audio/*" disabled={disabled} onPick={onPick} label="Choose an audio track">
      {src ? (
        <>
          <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} preload="metadata" />
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause preview" : "Play preview"}
            className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
          </button>
          <span className="max-w-full truncate px-6 text-[11px] font-medium">{name}</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Music className="size-3" />
            {progress !== null ? "Uploading…" : duration ? `${Math.round(duration)}s` : "Ready"}
          </span>
          {!disabled && <ClearButton onClear={onClear} label="Remove audio" />}
          {progress !== null && <Progress value={progress} />}
        </>
      ) : (
        <>
          <Music className="size-4 text-muted-foreground" />
          <span className="text-[11px] font-medium">Music / audio</span>
          {state.error ? <SlotError message={state.error} /> : <span className="text-[10px] text-muted-foreground">Drop or click</span>}
        </>
      )}
    </DropTile>
  );
}
