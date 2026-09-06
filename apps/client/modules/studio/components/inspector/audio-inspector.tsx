"use client";

import * as React from "react";
import { Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { useEditorStore } from "../../stores/editor-store";
import { Field, InspectorSection, NumberField, SliderField } from "./controls";

/** Contextual inspector for a selected audio clip (§21). */
export function AudioInspector({ audioId }: { audioId: string }) {
  const track = useEditorStore((s) => s.document?.audioTracks.find((t) => t.id === audioId));
  const projectDuration = useEditorStore((s) => s.document?.canvas.duration ?? 10);
  const store = useEditorStore.getState;

  if (!track) return null;

  const update = (patch: Partial<typeof track>) => store().updateAudioTrack(track.id, patch);

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
