import {
  isKnownIcon,
  parseProjectDocument,
  type AdvertisementPlan,
  type Background,
  type CanvasConfig,
  type EntranceAnimation,
  type Easing,
  type Layer,
  type LoopAnimation,
  type ProjectDocument,
} from "@workspace/motion";
import { measureLine, wrapBalanced, type TextMetrics } from "./text-layout";
import type { GenerationAudio, GenerationBackground } from "./generation-media";

/** User media, already resolved from asset ids. Only what the layout needs. */
export interface CompileMedia {
  background?: Pick<GenerationBackground, "kind" | "url" | "duration" | "luminance">;
  audio?: Pick<GenerationAudio, "url" | "filename" | "duration">;
}

/**
 * Compiles a plan into a project document.
 *
 * Entirely deterministic — no model output is ever placed, positioned or
 * animated directly. The plan supplies *words and colours*; every coordinate,
 * z-index, timing value and animation below is chosen by this code, then the
 * whole thing is run through `parseProjectDocument`. That is what §36 means by
 * "never allow raw AI output to directly mutate the editor".
 *
 * Layout is a vertical stack per screen, never fixed positions: every text
 * block is wrapped with explicit line breaks, sized to its real height, and
 * stacked with a gap. If a screen's stack is taller than the safe area, the
 * whole screen's type scales down together until it fits. Two elements on
 * the same screen therefore cannot overlap, and screens never share time.
 */

let counter = 0;
const nextId = (prefix: string) => `ai-${prefix}-${(counter = (counter + 1) % 100000)}`;

// ---------------------------------------------------------------------------
// Specs: what goes on a screen, before layout
// ---------------------------------------------------------------------------

interface Motion {
  enter: EntranceAnimation;
  easing?: Easing;
  loop?: LoopAnimation;
}

interface TextSpec extends Motion {
  kind: "text";
  role: string;
  text: string;
  /** Font size as a fraction of the canvas's short side. */
  size: number;
  minSize: number;
  weight: number;
  lineHeight: number;
  /** Tracking in ems, so it scales with the type. */
  tracking: number;
  uppercase?: boolean;
  maxLines: number;
  color: string;
  /** Gap above this element, as a multiple of the base gap. */
  gapBefore?: number;
}

interface IconSpec extends Motion {
  kind: "icon";
  name: string;
  color: string;
  size: number;
  gapBefore?: number;
}

interface RuleSpec extends Motion {
  kind: "rule";
  color: string;
  width: number;
  gapBefore?: number;
}

interface CtaSpec extends Motion {
  kind: "cta";
  text: string;
  size: number;
  color: string;
  fill: string;
  gapBefore?: number;
}

type Spec = TextSpec | IconSpec | RuleSpec | CtaSpec;

interface Placed {
  spec: Spec;
  width: number;
  height: number;
  fontSize?: number;
  letterSpacing?: number;
  lines?: string[];
  y?: number;
}

interface Screen {
  name: string;
  specs: Spec[];
  /** Relative share of the runtime, before normalising. */
  weight: number;
}

// ---------------------------------------------------------------------------

export function compilePlanToDocument(
  plan: AdvertisementPlan,
  canvas: CanvasConfig,
  media: CompileMedia = {},
): ProjectDocument {
  const [primary = "#7c3aed", secondary = "#ec4899", tertiary] = plan.palette;
  // Over a photo, text is always light on a darkened image.
  const light = !media.background && plan.backgroundStyle === "light";
  const ink = light ? "#0c0a09" : "#ffffff";
  const muted = light ? "#57534e" : mix(secondary, "#ffffff", 0.7);
  const accent = light ? darkenBy(primary, 0.15) : mix(primary, "#ffffff", 0.35);
  const iconColor = light ? primary : mix(tertiary ?? secondary, "#ffffff", 0.15);

  const frame = safeArea(canvas);
  const screens = buildScreens(plan, canvas.duration, { ink, muted, accent, iconColor, primary, light });
  const timings = allocateTime(screens, canvas.duration);

  const layers: Layer[] = [];
  const scenes: ProjectDocument["scenes"] = [];
  let z = 0;
  const push = (layer: Omit<Layer, "zIndex">) => {
    layers.push({ ...layer, zIndex: z++ } as Layer);
  };

  if (media.background) {
    // --- The user's image or video, full-bleed, with an overlay -------------
    for (const layer of backdrop(media.background, canvas, Boolean(media.audio))) push(layer);
  } else {
    // --- Ambient background blooms, full length -----------------------------
    const bloom = Math.max(canvas.width, canvas.height);
    push(gradientLayer(primary, { x: canvas.width * 0.2, y: canvas.height * 0.18, size: bloom * 0.95, duration: canvas.duration, light }));
    push(gradientLayer(secondary, { x: canvas.width * 0.85, y: canvas.height * 0.82, size: bloom * 0.8, duration: canvas.duration, light }));
  }

  // --- Story-style progress segments, one per screen ------------------------
  for (const layer of progressLayers(timings, canvas, frame, { ink, accent: light ? primary : "#ffffff" })) push(layer);

  // --- Screens -------------------------------------------------------------
  screens.forEach((screen, index) => {
    const { start, end } = timings[index]!;
    const sceneId = nextId("scene");
    const isLast = index === screens.length - 1;
    scenes.push({
      id: sceneId,
      name: screen.name.slice(0, 40) || `Scene ${index + 1}`,
      startTime: round(start),
      duration: round(end - start),
      // Stage-level transitions would also move the background blooms and
      // progress bar; per-layer entrances and exits carry the motion instead.
      transition: { type: "none", duration: 0, easing: "easeInOut", direction: "left" },
    });

    const placed = layoutScreen(screen.specs, frame);
    const span = end - start;
    const lead = Math.min(0.15, span * 0.05);
    const stagger = Math.min(0.16, (span * 0.25) / Math.max(1, placed.length));
    const enterDuration = clamp(span * 0.22, 0.3, 0.7);
    const exitDuration = clamp(span * 0.1, 0.2, 0.35);

    placed.forEach((item, i) => {
      const layerStart = start + lead + i * stagger;
      const timing = {
        startTime: round(layerStart),
        duration: round(Math.max(0.1, end - layerStart - (isLast ? 0 : 0.02))),
        enterDuration,
        exitDuration: isLast ? 0 : exitDuration,
        sceneId,
      };
      push(toLayer(item, canvas, timing));
    });
  });

  // The final parse is the guard: if anything above produced an out-of-range
  // value, this throws rather than persisting a document the renderer can't read.
  return parseProjectDocument({
    version: 1,
    canvas,
    background: media.background ? { type: "solid", value: "#05030c" } : buildBackground(plan, primary),
    layers,
    audioTracks: media.audio ? [musicTrack(media.audio, canvas.duration)] : [],
    scenes,
    palette: plan.palette,
  });
}

// ---------------------------------------------------------------------------
// Content → screens
// ---------------------------------------------------------------------------

function buildScreens(
  plan: AdvertisementPlan,
  duration: number,
  c: { ink: string; muted: string; accent: string; iconColor: string; primary: string; light: boolean },
): Screen[] {
  const screens: Screen[] = [];

  // Opening hook.
  const opening: Spec[] = [
    {
      kind: "text",
      role: "Headline",
      text: plan.headline,
      size: 0.135,
      minSize: 0.055,
      weight: 800,
      lineHeight: 1.02,
      tracking: -0.02,
      uppercase: true,
      maxLines: 3,
      color: c.ink,
      enter: "zoomIn",
      easing: "easeOutBack",
    },
  ];
  if (plan.subheadline) {
    opening.push({ kind: "rule", color: c.accent, width: 0.12, enter: "wipeIn", gapBefore: 0.9 });
    opening.push({
      kind: "text",
      role: "Subheadline",
      text: plan.subheadline,
      size: 0.046,
      minSize: 0.028,
      weight: 500,
      lineHeight: 1.3,
      tracking: 0,
      maxLines: 3,
      color: c.muted,
      enter: "slideUp",
      gapBefore: 0.9,
    });
  }
  screens.push({ name: "Opening", specs: opening, weight: readingWeight([plan.headline, plan.subheadline]) });

  // One screen per planned beat — at most what the runtime can show legibly.
  plan.scenes.slice(0, maxScenesFor(duration)).forEach((scene, index) => {
    const specs: Spec[] = [];
    if (scene.icon && isKnownIcon(scene.icon)) {
      specs.push({ kind: "icon", name: scene.icon, color: c.iconColor, size: 0.16, enter: "bounceIn", easing: "easeOutBack", loop: "float" });
    }
    if (scene.caption) {
      specs.push({
        kind: "text",
        role: "Caption",
        text: scene.caption,
        size: 0.03,
        minSize: 0.02,
        weight: 700,
        lineHeight: 1.25,
        tracking: 0.2,
        uppercase: true,
        maxLines: 2,
        color: c.accent,
        enter: "fadeIn",
      });
    }
    specs.push({
      kind: "text",
      role: "Title",
      text: scene.title,
      size: 0.088,
      minSize: 0.045,
      weight: 800,
      lineHeight: 1.06,
      tracking: -0.015,
      maxLines: 3,
      color: c.ink,
      enter: index % 2 === 0 ? "slideLeft" : "slideUp",
      gapBefore: scene.caption ? 0.55 : 1,
    });
    if (scene.body) {
      specs.push({ kind: "rule", color: c.accent, width: 0.1, enter: "wipeIn" });
      specs.push({
        kind: "text",
        role: "Body",
        text: scene.body,
        size: 0.044,
        minSize: 0.026,
        weight: 400,
        lineHeight: 1.38,
        tracking: 0,
        maxLines: 5,
        color: c.muted,
        enter: "blurIn",
      });
    }
    screens.push({
      name: scene.title,
      specs,
      weight: readingWeight([scene.caption, scene.title, scene.body]),
    });
  });

  // Close on the brand line and the action.
  screens.push({
    name: "Call to action",
    specs: [
      {
        kind: "text",
        role: "Sign-off",
        text: plan.headline,
        size: 0.062,
        minSize: 0.036,
        weight: 800,
        lineHeight: 1.08,
        tracking: -0.01,
        maxLines: 2,
        color: c.ink,
        enter: "fadeIn",
      },
      {
        kind: "cta",
        text: plan.cta,
        size: 0.046,
        color: c.light ? "#fafafa" : "#0b0713",
        fill: c.light ? c.primary : "#ffffff",
        enter: "bounceIn",
        easing: "easeOutBack",
        loop: "pulse",
        gapBefore: 1.3,
      },
    ],
    weight: 1,
  });

  return screens;
}

/** Title and CTA take ~2s; each beat needs ~1.6s to be read. */
const maxScenesFor = (duration: number) => Math.max(1, Math.floor((duration - 2) / 1.6));

/** Longer copy earns more screen time: roughly one extra unit per 12 words. */
function readingWeight(parts: (string | undefined)[]): number {
  const words = parts.filter(Boolean).join(" ").split(/\s+/).filter(Boolean).length;
  return 1 + words / 12;
}

/** Splits the runtime into back-to-back windows; screens never share time. */
function allocateTime(screens: Screen[], duration: number): { start: number; end: number }[] {
  const total = screens.reduce((sum, s) => sum + s.weight, 0);
  let cursor = 0;
  return screens.map((screen, i) => {
    const start = cursor;
    const end = i === screens.length - 1 ? duration : cursor + (duration * screen.weight) / total;
    cursor = end;
    return { start, end };
  });
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface Frame {
  top: number;
  bottom: number;
  /** Width text may be wrapped to. Boxes are wider than this, as slack. */
  measure: number;
  unit: number;
  gap: number;
}

/**
 * Keeps content clear of the platform chrome: portrait formats lose the top
 * to the progress bar and the bottom to captions, likes and the description.
 */
function safeArea(canvas: CanvasConfig): Frame {
  const portrait = canvas.height > canvas.width * 1.2;
  const unit = Math.min(canvas.width, canvas.height);
  return {
    top: canvas.height * (portrait ? 0.12 : 0.11),
    bottom: canvas.height * (portrait ? 0.82 : 0.9),
    measure: Math.min(canvas.width * 0.82, unit * 1.45),
    unit,
    gap: unit * 0.04,
  };
}

function layoutScreen(specs: Spec[], frame: Frame): Placed[] {
  const available = frame.bottom - frame.top;
  let scale = 1;
  let placed: Placed[] = [];

  for (let attempt = 0; attempt < 24; attempt++) {
    let fits = true;
    placed = specs.map((spec) => {
      const result = measureSpec(spec, frame, scale);
      if (!result.ok) fits = false;
      return result.placed;
    });
    const total = stackHeight(placed, frame.gap * scale);
    if (fits && total <= available) break;
    scale *= 0.93;
  }

  // Centre the stack in the safe area, nudged slightly above true centre.
  const gap = frame.gap * scale;
  const total = stackHeight(placed, gap);
  let cursor = frame.top + Math.max(0, (available - total) * 0.5);
  placed.forEach((item, i) => {
    if (i > 0) cursor += gap * (item.spec.gapBefore ?? 1);
    item.y = cursor + item.height / 2;
    cursor += item.height;
  });

  return placed;
}

function stackHeight(placed: Placed[], gap: number): number {
  return placed.reduce((sum, item, i) => sum + item.height + (i > 0 ? gap * (item.spec.gapBefore ?? 1) : 0), 0);
}

function measureSpec(spec: Spec, frame: Frame, scale: number): { placed: Placed; ok: boolean } {
  const u = frame.unit;
  switch (spec.kind) {
    case "icon": {
      const size = Math.round(Math.max(u * 0.07, u * spec.size * scale));
      return { placed: { spec, width: size, height: size }, ok: true };
    }
    case "rule": {
      const height = Math.max(3, Math.round(u * 0.007));
      return { placed: { spec, width: Math.round(u * spec.width), height }, ok: true };
    }
    case "cta": {
      const fontSize = Math.round(Math.max(u * 0.02, u * spec.size * scale));
      const metrics: TextMetrics = { fontSize, fontWeight: 800, letterSpacing: fontSize * 0.04, uppercase: true };
      const padX = Math.round(fontSize * 1.1);
      const padY = Math.round(fontSize * 0.6);
      const textWidth = measureLine(spec.text, metrics);
      // The pill always fits its label; a label too wide shrinks the screen's type instead.
      const width = textWidth * 1.18 + padX * 2;
      return {
        placed: {
          spec,
          width: Math.round(width),
          height: Math.round(fontSize * 1.2 + padY * 2),
          fontSize,
          letterSpacing: round(metrics.letterSpacing),
          lines: [spec.text],
        },
        ok: width <= frame.measure * 1.15,
      };
    }
    case "text": {
      const fontSize = Math.round(Math.max(u * spec.minSize, u * spec.size * scale));
      const letterSpacing = round(fontSize * spec.tracking);
      const metrics: TextMetrics = { fontSize, fontWeight: spec.weight, letterSpacing, uppercase: spec.uppercase };
      const wrapped = wrapBalanced(spec.text, frame.measure, metrics);
      // 18% + 1em of horizontal slack: a fallback font that runs wider than
      // the estimate still fits each line without re-wrapping it.
      const width = Math.min(frame.measure * 1.2, wrapped.width * 1.18 + fontSize);
      const height = wrapped.lines.length * fontSize * spec.lineHeight + fontSize * 0.12;
      return {
        placed: {
          spec,
          width: Math.round(Math.max(fontSize * 2, width)),
          height: Math.ceil(height),
          fontSize,
          letterSpacing,
          lines: wrapped.lines,
        },
        ok: !wrapped.overflowed && wrapped.lines.length <= spec.maxLines,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Placed → layers
// ---------------------------------------------------------------------------

interface LayerTiming {
  startTime: number;
  duration: number;
  enterDuration: number;
  exitDuration: number;
  sceneId: string;
}

function animationFor(motion: Motion, t: LayerTiming): Layer["animation"] {
  return {
    enter: { type: motion.enter, duration: t.enterDuration, delay: 0, easing: motion.easing ?? "easeOut", intensity: 1 },
    ...(t.exitDuration > 0
      ? { exit: { type: "fadeOut" as const, duration: t.exitDuration, delay: 0, easing: "easeIn" as const, intensity: 1 } }
      : {}),
    ...(motion.loop
      ? {
          loop: {
            type: motion.loop,
            duration: motion.loop === "pulse" ? 1.6 : 3.5,
            delay: 0,
            easing: "easeInOut" as const,
            intensity: motion.loop === "pulse" ? 0.6 : 0.8,
          },
        }
      : {}),
  };
}

function toLayer(item: Placed, canvas: CanvasConfig, t: LayerTiming): Omit<Layer, "zIndex"> {
  const { spec } = item;
  const base = {
    startTime: t.startTime,
    duration: t.duration,
    locked: false,
    hidden: false,
    blendMode: "normal" as const,
    sceneId: t.sceneId,
    animation: animationFor(spec, t),
    transform: {
      x: round(canvas.width / 2),
      y: round(item.y ?? canvas.height / 2),
      width: item.width,
      height: item.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    },
  };

  switch (spec.kind) {
    case "icon":
      return {
        ...base,
        id: nextId("icn"),
        type: "icon",
        name: spec.name.replace(/-/g, " "),
        properties: { name: spec.name, color: spec.color, strokeWidth: 1.75 },
      } as Omit<Layer, "zIndex">;

    case "rule":
      return {
        ...base,
        id: nextId("rule"),
        type: "shape",
        name: "Accent rule",
        properties: { kind: "roundedRect", fill: spec.color, strokeWidth: 0, cornerRadius: item.height },
      } as Omit<Layer, "zIndex">;

    case "cta": {
      const fontSize = item.fontSize!;
      return {
        ...base,
        id: nextId("cta"),
        type: "text",
        name: `CTA · ${spec.text}`.slice(0, 60),
        properties: {
          text: spec.text,
          fontFamily: "Inter",
          fontSize,
          fontWeight: 800,
          fontStyle: "normal",
          textTransform: "uppercase",
          align: "center",
          color: spec.color,
          lineHeight: 1.2,
          letterSpacing: item.letterSpacing ?? 0,
          backgroundColor: spec.fill,
          backgroundRadius: 999,
          paddingX: Math.round(fontSize * 0.5),
          paddingY: 0,
        },
      } as Omit<Layer, "zIndex">;
    }

    case "text": {
      const text = (item.lines ?? [spec.text]).map((l) => (spec.uppercase ? l.toUpperCase() : l)).join("\n");
      return {
        ...base,
        id: nextId("txt"),
        type: "text",
        name: `${spec.role} · ${spec.text}`.slice(0, 60),
        properties: {
          text,
          fontFamily: "Inter",
          fontSize: item.fontSize!,
          fontWeight: spec.weight,
          fontStyle: "normal",
          textTransform: "none",
          align: "center",
          color: spec.color,
          lineHeight: spec.lineHeight,
          letterSpacing: item.letterSpacing ?? 0,
          backgroundRadius: 0,
          paddingX: 0,
          paddingY: 0,
        },
      } as Omit<Layer, "zIndex">;
    }
  }
}

function progressLayers(
  timings: { start: number; end: number }[],
  canvas: CanvasConfig,
  frame: Frame,
  c: { ink: string; accent: string },
): Omit<Layer, "zIndex">[] {
  const count = timings.length;
  const totalWidth = Math.min(canvas.width * 0.86, frame.unit * 1.6);
  const gap = frame.unit * 0.012;
  const segment = (totalWidth - gap * (count - 1)) / count;
  const height = Math.max(4, Math.round(frame.unit * 0.0075));
  const y = round(frame.top * 0.45);
  const left = (canvas.width - totalWidth) / 2;
  const duration = timings[count - 1]!.end;

  const bar = (fill: string, x: number, start: number, opacity: number, reveal: number) =>
    ({
      id: nextId("prog"),
      type: "shape",
      name: reveal > 0 ? "Progress" : "Progress track",
      startTime: round(start),
      duration: round(duration - start),
      locked: false,
      hidden: false,
      blendMode: "normal",
      animation:
        reveal > 0
          ? { enter: { type: "wipeIn", duration: round(Math.min(10, reveal)), delay: 0, easing: "linear", intensity: 1 } }
          : {},
      transform: {
        x: round(x),
        y,
        width: Math.round(segment),
        height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity,
      },
      properties: { kind: "roundedRect", fill, strokeWidth: 0, cornerRadius: height },
    }) as Omit<Layer, "zIndex">;

  const layers: Omit<Layer, "zIndex">[] = [];
  timings.forEach(({ start, end }, i) => {
    const x = left + i * (segment + gap) + segment / 2;
    layers.push(bar(c.ink, x, 0, 0.22, 0));
    layers.push(bar(c.accent, x, start, 0.95, end - start));
  });
  return layers;
}

/**
 * The user's background as layers rather than the document background, so it
 * can move, plus a neutral overlay that keeps white type readable (brighter
 * media gets a stronger one).
 *
 * - An image gets a slow push-in over the whole short (half a pulse cycle),
 *   oversized slightly so the drift never reveals an edge.
 * - A video plays full-bleed. One shorter than the short is looped by laying
 *   identical clips end to end; a very short clip is also slowed so the loop
 *   never needs more than a handful of copies. Its own sound is kept only when
 *   the user didn't add separate music.
 */
function backdrop(
  background: NonNullable<CompileMedia["background"]>,
  canvas: CanvasConfig,
  hasMusic: boolean,
): Omit<Layer, "zIndex">[] {
  const duration = canvas.duration;
  const full = { x: canvas.width / 2, y: canvas.height / 2, scaleX: 1, scaleY: 1, rotation: 0 };
  const overlay = clamp(0.28 + background.luminance * 0.4, 0.34, 0.66);
  const fadeIn = { type: "fadeIn" as const, duration: Math.min(0.8, duration * 0.2), delay: 0, easing: "easeOut" as const, intensity: 1 };
  const layers: Omit<Layer, "zIndex">[] = [];

  if (background.kind === "image") {
    layers.push({
      id: nextId("bg"),
      type: "image",
      name: "Background image",
      startTime: 0,
      duration,
      locked: false,
      hidden: false,
      blendMode: "normal",
      animation: {
        enter: fadeIn,
        loop: { type: "pulse", duration: round(Math.min(60, duration * 2)), delay: 0, easing: "linear", intensity: 0.6 },
      },
      transform: { ...full, width: Math.round(canvas.width * 1.04), height: Math.round(canvas.height * 1.04), opacity: 1 },
      properties: { src: background.url, fit: "cover", cornerRadius: 0, brightness: 100, contrast: 105, saturation: 108, blur: 0 },
    } as Omit<Layer, "zIndex">);
  } else {
    const { clips } = planVideoLoop(background.duration, duration);
    clips.forEach((clip, i) => {
      layers.push({
        id: nextId("bgv"),
        type: "video",
        name: clips.length > 1 ? `Background video ${i + 1}/${clips.length}` : "Background video",
        startTime: round(clip.start),
        duration: round(clip.length),
        locked: false,
        hidden: false,
        blendMode: "normal",
        animation: i === 0 ? { enter: fadeIn } : {},
        transform: { ...full, width: canvas.width, height: canvas.height, opacity: 1 },
        properties: {
          src: background.url,
          fit: "cover",
          cornerRadius: 0,
          volume: hasMusic ? 0 : 0.7,
          muted: hasMusic,
          trimStart: 0,
          playbackRate: clip.rate,
        },
      } as Omit<Layer, "zIndex">);
    });
  }

  layers.push(
    {
      id: nextId("shade"),
      type: "shape",
      name: "Background overlay",
      startTime: 0,
      duration,
      locked: false,
      hidden: false,
      blendMode: "normal",
      animation: {},
      transform: { ...full, width: canvas.width, height: canvas.height, opacity: round(overlay) },
      // Neutral, so the photo keeps its own colours instead of being tinted.
      properties: { kind: "rectangle", fill: "#06050a", strokeWidth: 0, cornerRadius: 0 },
    } as Omit<Layer, "zIndex">,
  );
  return layers;
}

/** At most this many copies of a short clip are laid end to end. */
const MAX_VIDEO_LOOPS = 8;

/**
 * Splits the runtime into back-to-back plays of a clip. Unknown length is
 * treated as "long enough": one clip spanning the short.
 */
export function planVideoLoop(
  clipSeconds: number | undefined,
  duration: number,
): { clips: { start: number; length: number; rate: number }[] } {
  if (!clipSeconds || clipSeconds >= duration - 0.05) {
    return { clips: [{ start: 0, length: duration, rate: 1 }] };
  }
  let rate = 1;
  while (Math.ceil(duration / (clipSeconds / rate)) > MAX_VIDEO_LOOPS && rate > 0.25) {
    rate = Math.max(0.25, rate / 2);
  }
  const span = clipSeconds / rate;
  const clips: { start: number; length: number; rate: number }[] = [];
  for (let start = 0; start < duration - 0.1; start += span) {
    clips.push({ start, length: Math.min(span, duration - start), rate });
  }
  // A sliver left at the end (< 0.1s) is absorbed by the last clip.
  const last = clips[clips.length - 1]!;
  last.length = duration - last.start;
  return { clips };
}

/** The user's audio as a music bed, faded at both ends and trimmed to fit. */
function musicTrack(audio: NonNullable<CompileMedia["audio"]>, duration: number): ProjectDocument["audioTracks"][number] {
  const length = round(Math.max(0.1, Math.min(duration, audio.duration ?? duration)));
  return {
    id: nextId("music"),
    name: audio.filename.slice(0, 120) || "Music",
    src: audio.url,
    kind: "music",
    startTime: 0,
    duration: length,
    trimStart: 0,
    volume: 0.8,
    fadeIn: round(Math.min(0.6, length * 0.1)),
    fadeOut: round(Math.min(1.5, length * 0.15)),
    muted: false,
    locked: false,
  };
}

function gradientLayer(
  color: string,
  o: { x: number; y: number; size: number; duration: number; light: boolean },
): Omit<Layer, "zIndex"> {
  return {
    id: nextId("glow"),
    type: "gradient",
    name: "Ambient glow",
    startTime: 0,
    duration: o.duration,
    locked: false,
    hidden: false,
    blendMode: "normal",
    animation: {
      enter: { type: "fadeIn", duration: 1.2, delay: 0, easing: "easeOut", intensity: 1 },
      loop: { type: "float", duration: 10, delay: 0, easing: "easeInOut", intensity: 1 },
    },
    transform: {
      x: round(o.x),
      y: round(o.y),
      width: Math.round(o.size),
      height: Math.round(o.size),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: o.light ? 0.35 : 0.7,
    },
    properties: { kind: "blob", from: color, to: o.light ? "#f5f3ef" : "#05030c", angle: 135, blur: 90 },
  } as Omit<Layer, "zIndex">;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function buildBackground(plan: AdvertisementPlan, primary: string): Background {
  if (plan.backgroundStyle === "light") return { type: "solid", value: "#f5f3ef" };
  if (plan.backgroundStyle === "dark") return { type: "solid", value: "#07060c" };
  return { type: "gradient", from: darkenBy(primary, 0.58), to: "#05030c", angle: 165 };
}

function parseHex(hex: string): [number, number, number] | null {
  const normalized = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7);
  const value = parseInt(normalized.slice(1, 7), 16);
  if (Number.isNaN(value)) return null;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const toHex = (r: number, g: number, b: number) =>
  `#${((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, "0")}`;

/** Blends `a` toward `b` by `t` (0 = a, 1 = b). */
function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return b;
  return toHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
}

/** Pulls a colour toward black by `t`. */
function darkenBy(hex: string, t: number): string {
  return mix(hex, "#000000", t);
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
