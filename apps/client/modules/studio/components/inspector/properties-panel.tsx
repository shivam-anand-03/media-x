"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CaseSensitive,
  Italic,
  Layers as LayersIcon,
} from "lucide-react";
import {
  BLEND_MODES,
  CANVAS_PRESETS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  SHAPE_KINDS,
  describeCanvas,
  type BlendMode,
  type Layer,
} from "@workspace/motion";
import { Textarea } from "@workspace/ui/components/textarea";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { useEditorStore, selectSingleSelectedLayer } from "../../stores/editor-store";
import { Field, InspectorSection, NumberField, SegmentedField, SelectField, SliderField, ToggleRow } from "./controls";
import { ColorPicker } from "./color-picker";
import { AnimationSection } from "./animation-section";
import { ProjectSection } from "./project-section";
import { AudioInspector } from "./audio-inspector";

/**
 * The properties inspector (§22).
 *
 * Strictly contextual: it shows project settings when nothing is selected,
 * audio controls for an audio clip, and only the sections that apply to the
 * selected layer's type. A text layer never shows image filters, and an image
 * never shows letter spacing.
 */
export function PropertiesPanel({ className }: { className?: string }) {
  const layer = useEditorStore(selectSingleSelectedLayer);
  const selectionCount = useEditorStore((s) => s.selectedLayerIds.length);
  const selectedAudioId = useEditorStore((s) => s.selectedAudioId);

  return (
    <aside
      className={className}
      aria-label="Properties"
    >
      <ScrollArea className="h-full">
        {selectedAudioId ? (
          <AudioInspector audioId={selectedAudioId} />
        ) : selectionCount > 1 ? (
          <MultiSelectionInspector count={selectionCount} />
        ) : layer ? (
          <LayerInspector layer={layer} />
        ) : (
          <ProjectSection />
        )}
      </ScrollArea>
    </aside>
  );
}

/** With several layers selected, only the operations that make sense in bulk. */
function MultiSelectionInspector({ count }: { count: number }) {
  const store = useEditorStore.getState;
  return (
    <>
      <InspectorSection title="Selection">
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 p-3">
          <LayersIcon className="size-4 shrink-0 text-primary" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">{count} layers</span> selected
          </p>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Align, arrange or delete them together. Select a single layer to edit its properties.
        </p>
      </InspectorSection>

      <InspectorSection title="Arrange">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["Bring to front", "front"],
              ["Send to back", "back"],
              ["Forward", "forward"],
              ["Backward", "backward"],
            ] as const
          ).map(([label, direction]) => (
            <button
              key={direction}
              type="button"
              onClick={() => store().reorderSelectedLayers(direction)}
              className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </div>
      </InspectorSection>
    </>
  );
}

function LayerInspector({ layer }: { layer: Layer }) {
  return (
    <>
      <LayerHeader layer={layer} />
      {layer.type === "text" && <TextSections layer={layer} />}
      {layer.type === "shape" && <ShapeSection layer={layer} />}
      {layer.type === "icon" && <IconSection layer={layer} />}
      {layer.type === "image" && <ImageSection layer={layer} />}
      {layer.type === "video" && <VideoSection layer={layer} />}
      {layer.type === "gradient" && <GradientSection layer={layer} />}
      <TransformSection layer={layer} />
      <TimingSection layer={layer} />
      <AnimationSection layer={layer} />
      <AppearanceSection layer={layer} />
    </>
  );
}

const TYPE_LABEL: Record<Layer["type"], string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  shape: "Shape",
  icon: "Icon",
  gradient: "Gradient",
};

function LayerHeader({ layer }: { layer: Layer }) {
  return (
    <div className="border-b border-border/60 px-4 py-3">
      <p className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
        {TYPE_LABEL[layer.type]}
      </p>
      <Input
        value={layer.name}
        aria-label="Layer name"
        onChange={(e) => useEditorStore.getState().renameLayer(layer.id, e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-8 text-xs font-medium"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function TextSections({ layer }: { layer: Extract<Layer, { type: "text" }> }) {
  const p = layer.properties;
  const update = (patch: Partial<typeof p>, transient = false) =>
    useEditorStore.getState().updateLayer(
      layer.id,
      (l) => (l.type === "text" ? { ...l, properties: { ...l.properties, ...patch } } : l),
      { transient },
    );

  return (
    <>
      <InspectorSection title="Content">
        <Textarea
          value={p.text}
          aria-label="Text content"
          rows={3}
          onChange={(e) => update({ text: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          className="resize-none text-xs"
        />
      </InspectorSection>

      <InspectorSection title="Typography">
        <SelectField
          label="Font"
          value={p.fontFamily}
          options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))}
          onChange={(fontFamily) => update({ fontFamily })}
        />

        <SelectField
          label="Weight"
          value={String(p.fontWeight)}
          options={FONT_WEIGHTS.map((w) => ({ value: String(w.value), label: w.label }))}
          onChange={(weight) => update({ fontWeight: Number(weight) })}
        />

        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Size" value={p.fontSize} min={1} max={2000} suffix="px" onChange={(fontSize) => update({ fontSize })} />
          <NumberField
            label="Line height"
            value={p.lineHeight}
            min={0.5}
            max={4}
            step={0.05}
            precision={2}
            onChange={(lineHeight) => update({ lineHeight })}
          />
        </div>

        <NumberField
          label="Letter spacing"
          value={p.letterSpacing}
          min={-50}
          max={200}
          step={0.5}
          precision={1}
          suffix="px"
          onChange={(letterSpacing) => update({ letterSpacing })}
        />

        <SegmentedField
          label="Alignment"
          value={p.align}
          onChange={(align) => update({ align })}
          options={[
            { value: "left", label: <AlignLeft className="size-3.5" />, title: "Align left" },
            { value: "center", label: <AlignCenter className="size-3.5" />, title: "Align centre" },
            { value: "right", label: <AlignRight className="size-3.5" />, title: "Align right" },
          ]}
        />

        <ToggleRow
          label="Style"
          items={[
            {
              key: "bold",
              icon: <Bold className="size-3.5" />,
              title: "Bold",
              active: p.fontWeight >= 700,
              // Toggling returns to a regular weight rather than whatever odd
              // value was there before, which is what users expect from B.
              onToggle: () => update({ fontWeight: p.fontWeight >= 700 ? 400 : 700 }),
            },
            {
              key: "italic",
              icon: <Italic className="size-3.5" />,
              title: "Italic",
              active: p.fontStyle === "italic",
              onToggle: () => update({ fontStyle: p.fontStyle === "italic" ? "normal" : "italic" }),
            },
            {
              key: "uppercase",
              icon: <CaseSensitive className="size-3.5" />,
              title: "Uppercase",
              active: p.textTransform === "uppercase",
              onToggle: () => update({ textTransform: p.textTransform === "uppercase" ? "none" : "uppercase" }),
            },
          ]}
        />
      </InspectorSection>

      <InspectorSection title="Fill">
        <Field label="Text colour">
          <ColorPicker label="Text colour" value={p.color} onChange={(color) => update({ color })} />
        </Field>

        <Field label="Background" hint="Turns the text into a button or badge.">
          <ColorPicker
            label="Background colour"
            value={p.backgroundColor ?? "#ffffff"}
            allowClear={Boolean(p.backgroundColor)}
            onClear={() => update({ backgroundColor: undefined })}
            onChange={(backgroundColor) => update({ backgroundColor })}
          />
        </Field>

        {p.backgroundColor && (
          <>
            <NumberField
              label="Corner radius"
              value={p.backgroundRadius}
              min={0}
              max={9999}
              suffix="px"
              onChange={(backgroundRadius) => update({ backgroundRadius })}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Padding X" value={p.paddingX} min={0} max={400} suffix="px" onChange={(paddingX) => update({ paddingX })} />
              <NumberField label="Padding Y" value={p.paddingY} min={0} max={400} suffix="px" onChange={(paddingY) => update({ paddingY })} />
            </div>
          </>
        )}
      </InspectorSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shape / icon / media
// ---------------------------------------------------------------------------

function ShapeSection({ layer }: { layer: Extract<Layer, { type: "shape" }> }) {
  const p = layer.properties;
  const update = (patch: Partial<typeof p>) =>
    useEditorStore.getState().updateLayer(layer.id, (l) =>
      l.type === "shape" ? { ...l, properties: { ...l.properties, ...patch } } : l,
    );

  return (
    <InspectorSection title="Shape">
      <SelectField
        label="Type"
        value={p.kind}
        options={SHAPE_KINDS.map((k) => ({ value: k, label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) }))}
        onChange={(kind) => update({ kind })}
      />
      <Field label="Fill">
        <ColorPicker label="Fill colour" value={p.fill} onChange={(fill) => update({ fill })} />
      </Field>
      <Field label="Stroke">
        <ColorPicker
          label="Stroke colour"
          value={p.stroke ?? "#ffffff"}
          allowClear={Boolean(p.stroke)}
          onClear={() => update({ stroke: undefined, strokeWidth: 0 })}
          onChange={(stroke) => update({ stroke, strokeWidth: p.strokeWidth || 2 })}
        />
      </Field>
      {p.stroke && (
        <NumberField label="Stroke width" value={p.strokeWidth} min={0} max={200} suffix="px" onChange={(strokeWidth) => update({ strokeWidth })} />
      )}
      {(p.kind === "roundedRect" || p.kind === "rectangle") && (
        <NumberField label="Corner radius" value={p.cornerRadius} min={0} max={2000} suffix="px" onChange={(cornerRadius) => update({ cornerRadius })} />
      )}
    </InspectorSection>
  );
}

function IconSection({ layer }: { layer: Extract<Layer, { type: "icon" }> }) {
  const p = layer.properties;
  const update = (patch: Partial<typeof p>) =>
    useEditorStore.getState().updateLayer(layer.id, (l) =>
      l.type === "icon" ? { ...l, properties: { ...l.properties, ...patch } } : l,
    );

  return (
    <InspectorSection title="Icon">
      <Field label="Colour">
        <ColorPicker label="Icon colour" value={p.color} onChange={(color) => update({ color })} />
      </Field>
      <SliderField
        label="Stroke weight"
        value={p.strokeWidth}
        min={0.5}
        max={6}
        step={0.25}
        format={(v) => v.toFixed(2)}
        onChange={(strokeWidth) => update({ strokeWidth })}
      />
    </InspectorSection>
  );
}

function ImageSection({ layer }: { layer: Extract<Layer, { type: "image" }> }) {
  const p = layer.properties;
  const update = (patch: Partial<typeof p>, transient = false) =>
    useEditorStore.getState().updateLayer(
      layer.id,
      (l) => (l.type === "image" ? { ...l, properties: { ...l.properties, ...patch } } : l),
      { transient },
    );

  return (
    <InspectorSection title="Image">
      <SegmentedField
        label="Fit"
        value={p.fit}
        onChange={(fit) => update({ fit })}
        options={[
          { value: "cover", label: "Cover" },
          { value: "contain", label: "Contain" },
          { value: "fill", label: "Fill" },
        ]}
      />
      <NumberField label="Corner radius" value={p.cornerRadius} min={0} max={2000} suffix="px" onChange={(cornerRadius) => update({ cornerRadius })} />
      <SliderField label="Brightness" value={p.brightness} min={0} max={200} format={(v) => `${v}%`} onChange={(brightness) => update({ brightness }, true)} onCommit={() => update({})} />
      <SliderField label="Contrast" value={p.contrast} min={0} max={200} format={(v) => `${v}%`} onChange={(contrast) => update({ contrast }, true)} onCommit={() => update({})} />
      <SliderField label="Saturation" value={p.saturation} min={0} max={200} format={(v) => `${v}%`} onChange={(saturation) => update({ saturation }, true)} onCommit={() => update({})} />
      <SliderField label="Blur" value={p.blur} min={0} max={100} format={(v) => `${v}px`} onChange={(blur) => update({ blur }, true)} onCommit={() => update({})} />
    </InspectorSection>
  );
}

function VideoSection({ layer }: { layer: Extract<Layer, { type: "video" }> }) {
  const p = layer.properties;
  const update = (patch: Partial<typeof p>) =>
    useEditorStore.getState().updateLayer(layer.id, (l) =>
      l.type === "video" ? { ...l, properties: { ...l.properties, ...patch } } : l,
    );

  return (
    <InspectorSection title="Video">
      <SegmentedField
        label="Fit"
        value={p.fit}
        onChange={(fit) => update({ fit })}
        options={[
          { value: "cover", label: "Cover" },
          { value: "contain", label: "Contain" },
          { value: "fill", label: "Fill" },
        ]}
      />
      <NumberField label="Trim start" value={p.trimStart} min={0} max={3600} step={0.1} precision={2} suffix="s" onChange={(trimStart) => update({ trimStart })} />
      <SliderField label="Speed" value={p.playbackRate} min={0.25} max={4} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(playbackRate) => update({ playbackRate })} />
      <SegmentedField
        label="Audio"
        value={p.muted ? "muted" : "on"}
        onChange={(next) => update({ muted: next === "muted" })}
        options={[
          { value: "muted", label: "Muted" },
          { value: "on", label: "Play sound" },
        ]}
      />
      {!p.muted && (
        <SliderField label="Volume" value={Math.round(p.volume * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => update({ volume: v / 100 })} />
      )}
      <NumberField label="Corner radius" value={p.cornerRadius} min={0} max={2000} suffix="px" onChange={(cornerRadius) => update({ cornerRadius })} />
    </InspectorSection>
  );
}

function GradientSection({ layer }: { layer: Extract<Layer, { type: "gradient" }> }) {
  const p = layer.properties;
  const update = (patch: Partial<typeof p>) =>
    useEditorStore.getState().updateLayer(layer.id, (l) =>
      l.type === "gradient" ? { ...l, properties: { ...l.properties, ...patch } } : l,
    );

  return (
    <InspectorSection title="Gradient">
      <SegmentedField
        label="Style"
        value={p.kind}
        onChange={(kind) => update({ kind })}
        options={[
          { value: "blob", label: "Bloom" },
          { value: "radial", label: "Radial" },
          { value: "linear", label: "Linear" },
        ]}
      />
      <Field label="From">
        <ColorPicker label="Gradient start" value={p.from} onChange={(from) => update({ from })} />
      </Field>
      <Field label="To">
        <ColorPicker label="Gradient end" value={p.to} onChange={(to) => update({ to })} />
      </Field>
      {p.kind === "linear" && (
        <SliderField label="Angle" value={p.angle} min={0} max={360} format={(v) => `${v}°`} onChange={(angle) => update({ angle })} />
      )}
      <SliderField label="Softness" value={p.blur} min={0} max={400} format={(v) => `${v}px`} onChange={(blur) => update({ blur })} />
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// Transform / timing / appearance
// ---------------------------------------------------------------------------

function TransformSection({ layer }: { layer: Layer }) {
  const t = layer.transform;
  const patch = (next: Partial<typeof t>) =>
    useEditorStore.getState().patchLayerTransform(layer.id, next);

  return (
    <InspectorSection title="Transform">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={Math.round(t.x)} suffix="px" onChange={(x) => patch({ x })} />
        <NumberField label="Y" value={Math.round(t.y)} suffix="px" onChange={(y) => patch({ y })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Width" value={Math.round(t.width)} min={1} suffix="px" onChange={(width) => patch({ width })} />
        <NumberField label="Height" value={Math.round(t.height)} min={1} suffix="px" onChange={(height) => patch({ height })} />
      </div>
      <SliderField
        label="Rotation"
        value={Math.round(t.rotation)}
        min={-180}
        max={180}
        format={(v) => `${v}°`}
        onChange={(rotation) => patch({ rotation })}
      />
    </InspectorSection>
  );
}

function TimingSection({ layer }: { layer: Layer }) {
  const duration = useEditorStore((s) => s.document?.canvas.duration ?? 10);
  const setTiming = (timing: { startTime?: number; duration?: number }) =>
    useEditorStore.getState().setLayerTiming(layer.id, timing);

  return (
    <InspectorSection title="Timing">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Start"
          value={layer.startTime}
          min={0}
          max={duration}
          step={0.1}
          precision={2}
          suffix="s"
          onChange={(startTime) => setTiming({ startTime })}
        />
        <NumberField
          label="Duration"
          value={layer.duration}
          min={0.1}
          max={duration}
          step={0.1}
          precision={2}
          suffix="s"
          onChange={(value) => setTiming({ duration: value })}
        />
      </div>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        On screen {layer.startTime.toFixed(1)}s – {(layer.startTime + layer.duration).toFixed(1)}s
      </p>
    </InspectorSection>
  );
}

function AppearanceSection({ layer }: { layer: Layer }) {
  const patch = (next: Partial<Layer["transform"]>, transient = false) =>
    useEditorStore.getState().patchLayerTransform(layer.id, next, { transient });

  return (
    <InspectorSection title="Appearance">
      <SliderField
        label="Opacity"
        value={Math.round(layer.transform.opacity * 100)}
        min={0}
        max={100}
        format={(v) => `${v}%`}
        onChange={(v) => patch({ opacity: v / 100 }, true)}
        onCommit={() => patch({})}
      />
      <SelectField
        label="Blend mode"
        value={layer.blendMode}
        options={BLEND_MODES.map((m) => ({
          value: m as BlendMode,
          label: m.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
        }))}
        onChange={(blendMode) =>
          useEditorStore.getState().updateLayer(layer.id, (l) => ({ ...l, blendMode }))
        }
      />
    </InspectorSection>
  );
}

export { CANVAS_PRESETS, describeCanvas };
