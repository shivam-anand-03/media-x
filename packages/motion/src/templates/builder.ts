import type {
  Background,
  EntranceAnimation,
  Easing,
  ExitAnimation,
  Layer,
  LoopAnimation,
  ProjectDocument,
  ShapeProperties,
  TextProperties,
  Transition,
} from "../schema";
import { estimateTextWidth, TYPOGRAPHY_PRESETS, type TypographyPreset } from "../presets";

/**
 * A compact builder for authoring templates.
 *
 * Templates are real `ProjectDocument`s — the same shape the editor saves — so
 * "use template" is just "load this document". The builder exists purely to
 * keep the ten template files readable: it resolves typography presets, sizes
 * type relative to the canvas, and assigns z-indices in declaration order.
 */

export interface BuilderCanvas {
  width: number;
  height: number;
  fps?: 24 | 25 | 30 | 50 | 60;
  duration: number;
}

interface TimingSpec {
  at: number;
  /** Defaults to "until the end of the project". */
  for?: number;
}

interface AnimSpec {
  enter?: EntranceAnimation;
  enterDuration?: number;
  enterDelay?: number;
  enterEasing?: Easing;
  exit?: ExitAnimation;
  exitDuration?: number;
  loop?: LoopAnimation;
  loopDuration?: number;
  intensity?: number;
}

interface PlacementSpec {
  /** Fractions of canvas width/height; 0.5/0.5 is dead centre. */
  x?: number;
  y?: number;
  rotation?: number;
  opacity?: number;
}

function buildAnimation(spec: AnimSpec | undefined) {
  if (!spec) return {};
  const intensity = spec.intensity ?? 1;
  return {
    ...(spec.enter && spec.enter !== "none"
      ? {
          enter: {
            type: spec.enter,
            duration: spec.enterDuration ?? 0.6,
            delay: spec.enterDelay ?? 0,
            easing: spec.enterEasing ?? ("easeOut" as Easing),
            intensity,
          },
        }
      : {}),
    ...(spec.exit && spec.exit !== "none"
      ? { exit: { type: spec.exit, duration: spec.exitDuration ?? 0.4, delay: 0, easing: "easeIn" as Easing, intensity } }
      : {}),
    ...(spec.loop && spec.loop !== "none"
      ? { loop: { type: spec.loop, duration: spec.loopDuration ?? 3, delay: 0, easing: "easeInOut" as Easing, intensity } }
      : {}),
  };
}

export class TemplateBuilder {
  private layers: Layer[] = [];
  private audio: ProjectDocument["audioTracks"] = [];
  private scenes: ProjectDocument["scenes"] = [];
  private z = 0;

  constructor(
    private readonly canvas: BuilderCanvas,
    private readonly background: Background,
    private readonly slug: string,
  ) {}

  private id(kind: string): string {
    this.z += 1;
    return `${this.slug}-${kind}-${this.z}`;
  }

  private common(timing: TimingSpec, placement: PlacementSpec | undefined, anim: AnimSpec | undefined) {
    const duration = timing.for ?? this.canvas.duration - timing.at;
    return {
      startTime: timing.at,
      duration: Math.max(0.1, Math.min(duration, this.canvas.duration - timing.at)),
      zIndex: this.z,
      locked: false,
      hidden: false,
      blendMode: "normal" as const,
      animation: buildAnimation(anim),
      placementX: (placement?.x ?? 0.5) * this.canvas.width,
      placementY: (placement?.y ?? 0.5) * this.canvas.height,
      rotation: placement?.rotation ?? 0,
      opacity: placement?.opacity ?? 1,
    };
  }

  /** Adds a text layer sized from a typography preset. */
  text(
    presetId: TypographyPreset["id"],
    text: string,
    timing: TimingSpec,
    placement?: PlacementSpec,
    anim?: AnimSpec,
    overrides?: Partial<TextProperties>,
  ): this {
    const preset = TYPOGRAPHY_PRESETS.find((p) => p.id === presetId) ?? TYPOGRAPHY_PRESETS[0]!;
    const id = this.id("txt");
    const c = this.common(timing, placement, anim);
    const props: TextProperties = { ...preset.properties, text, fontSize: Math.round(this.canvas.width * preset.sizeRatio), ...overrides };

    const lines = text.split("\n");

    // Shrink type that would not fit across the canvas rather than letting the
    // renderer wrap it. Templates put their line breaks in explicitly, so an
    // automatic wrap is always a layout accident, not the author's intent.
    const maxWidth = this.canvas.width * 0.92 - props.paddingX * 2;
    let estimated = estimateTextWidth(text, props.fontSize, props);
    if (estimated > maxWidth) {
      props.fontSize = Math.max(8, Math.floor(props.fontSize * (maxWidth / estimated)));
      estimated = estimateTextWidth(text, props.fontSize, props);
    }

    const width = Math.min(maxWidth, Math.max(props.fontSize * 2, estimated)) + props.paddingX * 2;
    const height = lines.length * props.fontSize * props.lineHeight + props.paddingY * 2;

    this.layers.push({
      id,
      type: "text",
      name: text.split("\n")[0]?.slice(0, 24) || preset.label,
      startTime: c.startTime,
      duration: c.duration,
      zIndex: c.zIndex,
      locked: false,
      hidden: false,
      blendMode: "normal",
      animation: c.animation,
      transform: {
        x: c.placementX,
        y: c.placementY,
        width: Math.round(width),
        height: Math.round(height),
        scaleX: 1,
        scaleY: 1,
        rotation: c.rotation,
        opacity: c.opacity,
      },
      properties: props,
    });
    return this;
  }

  /** Adds a shape sized as fractions of the canvas. */
  shape(
    properties: ShapeProperties,
    size: { w: number; h: number },
    timing: TimingSpec,
    placement?: PlacementSpec,
    anim?: AnimSpec,
  ): this {
    const c = this.common(timing, placement, anim);
    this.layers.push({
      id: this.id("shp"),
      type: "shape",
      name: properties.kind,
      startTime: c.startTime,
      duration: c.duration,
      zIndex: c.zIndex,
      locked: false,
      hidden: false,
      blendMode: "normal",
      animation: c.animation,
      transform: {
        x: c.placementX,
        y: c.placementY,
        width: Math.max(2, Math.round(this.canvas.width * size.w)),
        height: Math.max(2, Math.round(this.canvas.height * size.h)),
        scaleX: 1,
        scaleY: 1,
        rotation: c.rotation,
        opacity: c.opacity,
      },
      properties,
    });
    return this;
  }

  /** Adds a decorative gradient bloom. */
  glow(
    from: string,
    to: string,
    size: number,
    timing: TimingSpec,
    placement?: PlacementSpec,
    anim?: AnimSpec,
    kind: "blob" | "linear" | "radial" = "blob",
    blur = 90,
  ): this {
    const c = this.common(timing, placement, anim);
    const px = Math.round(this.canvas.width * size);
    this.layers.push({
      id: this.id("grd"),
      type: "gradient",
      name: "Glow",
      startTime: c.startTime,
      duration: c.duration,
      zIndex: c.zIndex,
      locked: false,
      hidden: false,
      blendMode: "normal",
      animation: c.animation,
      transform: { x: c.placementX, y: c.placementY, width: px, height: px, scaleX: 1, scaleY: 1, rotation: c.rotation, opacity: c.opacity },
      properties: { kind, from, to, angle: 135, blur },
    });
    return this;
  }

  icon(
    name: string,
    color: string,
    size: number,
    timing: TimingSpec,
    placement?: PlacementSpec,
    anim?: AnimSpec,
  ): this {
    const c = this.common(timing, placement, anim);
    const px = Math.round(this.canvas.width * size);
    this.layers.push({
      id: this.id("icn"),
      type: "icon",
      name,
      startTime: c.startTime,
      duration: c.duration,
      zIndex: c.zIndex,
      locked: false,
      hidden: false,
      blendMode: "normal",
      animation: c.animation,
      transform: { x: c.placementX, y: c.placementY, width: px, height: px, scaleX: 1, scaleY: 1, rotation: c.rotation, opacity: c.opacity },
      properties: { name, color, strokeWidth: 2 },
    });
    return this;
  }

  scene(name: string, at: number, duration: number, transition?: Partial<Transition>): this {
    this.scenes.push({
      id: `${this.slug}-scene-${this.scenes.length + 1}`,
      name,
      startTime: at,
      duration,
      transition: {
        type: transition?.type ?? "fade",
        duration: transition?.duration ?? 0.4,
        easing: transition?.easing ?? "easeInOut",
        direction: transition?.direction ?? "left",
      },
    });
    return this;
  }

  build(palette: string[] = []): ProjectDocument {
    return {
      version: 1,
      canvas: { width: this.canvas.width, height: this.canvas.height, fps: this.canvas.fps ?? 30, duration: this.canvas.duration },
      background: this.background,
      layers: this.layers,
      audioTracks: this.audio,
      scenes: this.scenes,
      palette,
    };
  }
}

export function template(canvas: BuilderCanvas, background: Background, slug: string): TemplateBuilder {
  return new TemplateBuilder(canvas, background, slug);
}
