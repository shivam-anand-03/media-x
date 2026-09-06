"use client";

import * as React from "react";
import { AlertTriangle, Loader2, RefreshCw, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { useEditorStore } from "../../stores/editor-store";
import { Field, InspectorSection, NumberField, SliderField } from "./controls";
import { useAssetUpload } from "../../hooks/use-asset-upload";

/** Contextual inspector for a selected audio clip (§21). */
export function AudioInspector({ audioId }: { audioId: string }) {
  const track = useEditorStore((s) => s.document?.audioTracks.find((t) => t.id === audioId));
  const projectDuration = useEditorStore((s) => s.document?.canvas.duration ?? 10);
  const unavailable = useEditorStore((s) => s.unavailableAudioIds.includes(audioId));
  const projectId = useEditorStore((s) => s.projectId);
  const store = useEditorStore.getState;

  const { uploads, upload } = useAssetUpload(projectId ?? undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const replacingRef = React.useRef(false);

  /**
   * Swaps the file behind this clip, keeping its timing, fades and volume.
   *
   * This is the way back from a broken track: the clip is already positioned
   * and levelled, so re-uploading should not mean rebuilding it from scratch.
   */
  React.useEffect(() => {
    if (!replacingRef.current) return;
    const done = uploads.find((u) => u.status === "done" && u.asset?.type === "AUDIO");
    if (!done?.asset) return;

    replacingRef.current = false;
    const state = useEditorStore.getState();
    state.updateAudioTrack(audioId, {
      src: done.asset.url,
      name: done.asset.filename.replace(/\.[^.]+$/, ""),
    });
    // The new file is a different resource, so clear the stale failure flag and
    // let playback re-evaluate it.
    state.markAudioUnavailable(audioId, false);
  }, [uploads, audioId]);

  if (!track) return null;

  const update = (patch: Partial<typeof track>) => store().updateAudioTrack(track.id, patch);
  const replacing = replacingRef.current && uploads.some((u) => u.status !== "error");

  return (
    <>
      <div className="border-b border-border/60 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
          {track.kind === "music" ? "Music" : track.kind === "sfx" ? "Sound effect" : "Voiceover"}
        </p>
        <Input
          value={track.name}
          aria-label="Audio track name"
          onChange={(e) => update({ name: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          className="h-8 text-xs font-medium"
        />
      </div>

      {unavailable && (
        <div className="mx-4 mt-4 rounded-md border border-destructive/30 bg-destructive/8 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            Audio file unavailable
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            This clip&apos;s file could not be loaded, so it will be silent — in the editor and in
            the export. Replace it below to keep this clip&apos;s timing and levels.
          </p>
          <Button
            size="sm"
            className="mt-2.5 w-full gap-1.5 text-xs"
            disabled={replacing}
            onClick={() => {
              replacingRef.current = true;
              fileInputRef.current?.click();
            }}
          >
            {replacing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {replacing ? "Uploading…" : "Replace audio file"}
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload([file]);
          // Reset so re-picking the same file still fires a change event.
          e.target.value = "";
        }}
      />

      <InspectorSection title="Timing">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Start"
            value={track.startTime}
            min={0}
            max={projectDuration}
            step={0.1}
            precision={2}
            suffix="s"
            onChange={(startTime) => store().setAudioTiming(track.id, { startTime })}
          />
          <NumberField
            label="Duration"
            value={track.duration}
            min={0.1}
            max={projectDuration}
            step={0.1}
            precision={2}
            suffix="s"
            onChange={(duration) => store().setAudioTiming(track.id, { duration })}
          />
        </div>
        <NumberField
          label="Trim from"
          value={track.trimStart}
          min={0}
          max={3600}
          step={0.1}
          precision={2}
          suffix="s"
          onChange={(trimStart) => store().setAudioTiming(track.id, { trimStart })}
        />
      </InspectorSection>

      <InspectorSection title="Levels">
        <SliderField
          label="Volume"
          value={Math.round(track.volume * 100)}
          min={0}
          max={100}
          format={(v) => `${v}%`}
          onChange={(v) => update({ volume: v / 100 })}
        />
        <SliderField
          label="Fade in"
          value={track.fadeIn}
          min={0}
          max={Math.min(10, track.duration)}
          step={0.1}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(fadeIn) => update({ fadeIn })}
        />
        <SliderField
          label="Fade out"
          value={track.fadeOut}
          min={0}
          max={Math.min(10, track.duration)}
          step={0.1}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(fadeOut) => update({ fadeOut })}
        />

        <Button
          variant={track.muted ? "default" : "outline"}
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => update({ muted: !track.muted })}
        >
          {track.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          {track.muted ? "Unmute track" : "Mute track"}
        </Button>
      </InspectorSection>

      <InspectorSection title="Manage">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          disabled={replacing}
          onClick={() => {
            replacingRef.current = true;
            fileInputRef.current?.click();
          }}
        >
          {replacing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {replacing ? "Uploading…" : "Replace file"}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => store().removeAudioTrack(track.id)}
        >
          <Trash2 className="size-3.5" />
          Remove from timeline
        </Button>
      </InspectorSection>
    </>
  );
}
