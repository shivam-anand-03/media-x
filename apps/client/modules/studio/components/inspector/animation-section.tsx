"use client";

import * as React from "react";
import { Play, Sparkles } from "lucide-react";
import {
  EASING_OPTIONS,
  ENTRANCE_OPTIONS,
  EXIT_OPTIONS,
  LOOP_OPTIONS,
  resolveLayerAtTime,
  type Easing,
  type Layer,
} from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { useEditorStore } from "../../stores/editor-store";
import { InspectorSection, SelectField, SliderField } from "./controls";

/**
 * The animation inspector (§19).
 *
 * Each of the three slots (entrance, exit, loop) only reveals its timing
 * controls once an animation is chosen, so "None" stays a single row instead
 * of four disabled ones. The preview button plays the layer's own animation in
 * place by scrubbing the real playhead — it is the actual animation, not a
 * separate canned demo.
 */
export function AnimationSection({ layer }: { layer: Layer }) {
  const update = (animation: Layer["animation"]) =>
    useEditorStore.getState().updateLayer(layer.id, (l) => ({ ...l, animation }));

  const enter = layer.animation.enter;
  const exit = layer.animation.exit;
  const loop = layer.animation.loop;

  return (
    <InspectorSection
      title="Animation"
      action={<PreviewButton layer={layer} />}
    >
      {/* ---- Entrance ---- */}
      <SelectField
        label="Entrance"
        value={enter?.type ?? "none"}
        options={ENTRANCE_OPTIONS}
        onChange={(type) =>
          update({
            ...layer.animation,
            enter:
              type === "none"
                ? undefined
                : { type, duration: enter?.duration ?? 0.6, delay: enter?.delay ?? 0, easing: enter?.easing ?? "easeOut", intensity: enter?.intensity ?? 1 },
          })
        }
      />

      {enter && enter.type !== "none" && (
        <TimingControls
          config={enter}
          maxDuration={Math.min(layer.duration, 10)}
          onChange={(next) => update({ ...layer.animation, enter: { ...enter, ...next } })}
        />
      )}

      {/* ---- Exit ---- */}
      <SelectField
        label="Exit"
        value={exit?.type ?? "none"}
        options={EXIT_OPTIONS}
        onChange={(type) =>
          update({
            ...layer.animation,
            exit:
              type === "none"
                ? undefined
                : { type, duration: exit?.duration ?? 0.4, delay: exit?.delay ?? 0, easing: exit?.easing ?? "easeIn", intensity: exit?.intensity ?? 1 },
          })
        }
      />

      {exit && exit.type !== "none" && (
        <TimingControls
          config={exit}
          maxDuration={Math.min(layer.duration, 10)}
          onChange={(next) => update({ ...layer.animation, exit: { ...exit, ...next } })}
        />
      )}

      {/* ---- Loop ---- */}
      <SelectField
        label="Loop"
        value={loop?.type ?? "none"}
        options={LOOP_OPTIONS}
        onChange={(type) =>
          update({
            ...layer.animation,
            loop:
              type === "none"
                ? undefined
                : { type, duration: loop?.duration ?? 2, delay: loop?.delay ?? 0, easing: loop?.easing ?? "easeInOut", intensity: loop?.intensity ?? 1 },
          })
        }
      />

      {loop && loop.type !== "none" && (
        <>
          <SliderField
            label="Cycle"
            value={loop.duration}
            min={0.2}
            max={12}
            step={0.1}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(duration) => update({ ...layer.animation, loop: { ...loop, duration } })}
          />
          <SliderField
            label="Intensity"
            value={loop.intensity}
            min={0}
            max={2}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(intensity) => update({ ...layer.animation, loop: { ...loop, intensity } })}
          />
        </>
      )}

      {!enter && !exit && !loop && (
        <p className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <Sparkles className="mt-px size-3.5 shrink-0 text-primary" />
          Add an entrance to make this layer arrive with intent instead of just appearing.
        </p>
      )}
    </InspectorSection>
  );
}

function TimingControls({
  config,
  maxDuration,
  onChange,
}: {
  config: { duration: number; delay: number; easing: Easing; intensity: number };
  maxDuration: number;
  onChange: (next: Partial<{ duration: number; delay: number; easing: Easing; intensity: number }>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/25 p-2.5">
      <SliderField
        label="Duration"
        value={config.duration}
        min={0.1}
        max={Math.max(0.5, maxDuration)}
        step={0.05}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={(duration) => onChange({ duration })}
      />
      <SliderField
        label="Delay"
        value={config.delay}
        min={0}
        max={Math.max(0.5, maxDuration)}
        step={0.05}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={(delay) => onChange({ delay })}
      />
      <SelectField
        label="Easing"
        value={config.easing}
        options={EASING_OPTIONS}
        onChange={(easing) => onChange({ easing })}
      />
      <SliderField
        label="Intensity"
        value={config.intensity}
        min={0}
        max={2}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(intensity) => onChange({ intensity })}
      />
    </div>
  );
}

/**
 * Plays this layer's animation in place.
 *
 * Rather than rendering a miniature mock, it drives the real playhead across
 * the layer's own span — so the preview is literally the animation that will
 * be exported.
 */
function PreviewButton({ layer }: { layer: Layer }) {
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const preview = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const store = useEditorStore.getState();
    store.pause();

    const start = layer.startTime;
    // Long enough to show the entrance settle, capped by the layer's own life.
    const window = Math.min(layer.duration, (layer.animation.enter?.duration ?? 0.6) + (layer.animation.enter?.delay ?? 0) + 0.9);
    const startedAt = performance.now();

    const step = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      if (elapsed >= window) {
        useEditorStore.getState().setCurrentTime(start + window);
        rafRef.current = null;
        return;
      }
      useEditorStore.getState().setCurrentTime(start + elapsed);
      rafRef.current = requestAnimationFrame(step);
    };

    store.setCurrentTime(start);
    rafRef.current = requestAnimationFrame(step);
  };

  const hasAnimation =
    Boolean(layer.animation.enter) || Boolean(layer.animation.exit) || Boolean(layer.animation.loop);

  return (
    <Button
      size="xs"
      variant="ghost"
      onClick={preview}
      disabled={!hasAnimation}
      className={cn("h-6 gap-1 text-[10px]", hasAnimation && "text-primary hover:text-primary")}
      aria-label="Preview this layer's animation"
    >
      <Play className="size-3" />
      Preview
    </Button>
  );
}
