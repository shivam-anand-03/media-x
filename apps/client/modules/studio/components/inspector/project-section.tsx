"use client";

import * as React from "react";
import { MonitorPlay } from "lucide-react";
import { BACKGROUND_PRESETS, describeCanvas, type Background } from "@workspace/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "../../stores/editor-store";
import { Field, InspectorSection, NumberField, SegmentedField, SliderField } from "./controls";
import { ColorPicker } from "./color-picker";

/**
 * Shown when nothing is selected (§22): the project's own settings — canvas,
 * length, frame rate and background.
 */
export function ProjectSection() {
  const doc = useEditorStore((s) => s.document);
  const store = useEditorStore.getState;

  if (!doc) return null;
  const { canvas, background } = doc;

  const setBackground = (next: Background) => store().setBackground(next);

  return (
    <>
      <InspectorSection title="Project">
        <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/40 p-3">
          <MonitorPlay className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {describeCanvas(canvas.width, canvas.height)}
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {canvas.width} × {canvas.height} · {canvas.fps} fps
            </p>
          </div>
        </div>

        <SliderField
          label="Duration"
          value={canvas.duration}
          min={1}
          max={60}
          step={0.5}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(duration) => store().setCanvasDuration(duration)}
        />

        <SegmentedField
          label="Frame rate"
          value={String(canvas.fps)}
          onChange={(fps) => store().setCanvasFps(Number(fps) as 24 | 30 | 60)}
          options={[
            { value: "24", label: "24" },
            { value: "30", label: "30" },
            { value: "60", label: "60" },
          ]}
        />
      </InspectorSection>

      <InspectorSection title="Background">
        <SegmentedField
          value={background.type}
          onChange={(type) => {
            if (type === "solid") setBackground({ type: "solid", value: "#07060c" });
            else if (type === "gradient")
              setBackground({ type: "gradient", from: "#2e1065", to: "#07060c", angle: 165 });
          }}
          options={[
            { value: "solid", label: "Solid" },
            { value: "gradient", label: "Gradient" },
          ]}
        />

        {background.type === "solid" && (
          <Field label="Colour">
            <ColorPicker
              label="Background colour"
              value={background.value}
              onChange={(value) => setBackground({ type: "solid", value })}
            />
          </Field>
        )}

        {background.type === "gradient" && (
          <>
            <Field label="From">
              <ColorPicker
                label="Gradient start"
                value={background.from}
                onChange={(from) => setBackground({ ...background, from })}
              />
            </Field>
            <Field label="To">
              <ColorPicker
                label="Gradient end"
                value={background.to}
                onChange={(to) => setBackground({ ...background, to })}
              />
            </Field>
            <SliderField
              label="Angle"
              value={background.angle}
              min={0}
              max={360}
              format={(v) => `${v}°`}
              onChange={(angle) => setBackground({ ...background, angle })}
            />
          </>
        )}

        <Field label="Presets">
          <div className="grid grid-cols-4 gap-1.5">
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                onClick={() => setBackground(preset.background)}
                className={cn(
                  "h-9 rounded-md border border-border/70 transition-transform hover:scale-105",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                )}
                style={{ background: previewCss(preset.background) }}
              />
            ))}
          </div>
        </Field>
      </InspectorSection>

      <InspectorSection title="Stats">
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat label="Layers" value={doc.layers.length} />
          <Stat label="Scenes" value={doc.scenes.length} />
          <Stat label="Audio" value={doc.audioTracks.length} />
          <Stat label="Frames" value={Math.round(canvas.duration * canvas.fps)} />
        </dl>
      </InspectorSection>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-2">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function previewCss(background: Background): string {
  if (background.type === "solid") return background.value;
  if (background.type === "gradient")
    return `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;
  return "#000";
}
