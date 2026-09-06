import type {
  Background,
  EntranceAnimation,
  ExitAnimation,
  Easing,
  Layer,
  LoopAnimation,
  ShapeProperties,
  TextProperties,
} from "./schema";

/**
 * Every fixed list the UI offers the user. Keeping them here — beside the
 * schema they must agree with — means a new animation or canvas format is one
 * edit, not a hunt through panels.
 */

// ---------------------------------------------------------------------------
// Canvas presets
// ---------------------------------------------------------------------------

export interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  fps: 24 | 25 | 30 | 50 | 60;
  duration: number;
  /** Shown under the label, e.g. "9:16". */
  ratio: string;
  group: "social" | "display";
}

export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { id: "instagram-reel", label: "Instagram Reel", width: 1080, height: 1920, fps: 30, duration: 10, ratio: "9:16", group: "social" },
  { id: "instagram-post", label: "Instagram Post", width: 1080, height: 1080, fps: 30, duration: 10, ratio: "1:1", group: "social" },
  { id: "youtube", label: "YouTube", width: 1920, height: 1080, fps: 30, duration: 15, ratio: "16:9", group: "social" },
  { id: "youtube-short", label: "YouTube Short", width: 1080, height: 1920, fps: 30, duration: 15, ratio: "9:16", group: "social" },
  { id: "presentation", label: "Presentation", width: 1920, height: 1080, fps: 30, duration: 12, ratio: "16:9", group: "display" },
  { id: "digital-display", label: "Digital Display", width: 1920, height: 1080, fps: 30, duration: 12, ratio: "16:9", group: "display" },
] as const;

export const DEFAULT_CANVAS_PRESET_ID = "instagram-reel";

export function getCanvasPreset(id: string): CanvasPreset | undefined {
  return CANVAS_PRESETS.find((p) => p.id === id);
}

/** Human label for a canvas size, used on project cards. */
export function describeCanvas(width: number, height: number): string {
  const preset = CANVAS_PRESETS.find((p) => p.width === width && p.height === height);
  if (preset) return preset.label;
  const divisor = gcd(width, height);
  return `${width} × ${height} (${width / divisor}:${height / divisor})`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// ---------------------------------------------------------------------------
// Animation presets
// ---------------------------------------------------------------------------

export interface AnimationOption<T extends string> {
  value: T;
  label: string;
}

export const ENTRANCE_OPTIONS: readonly AnimationOption<EntranceAnimation>[] = [
  { value: "none", label: "None" },
  { value: "fadeIn", label: "Fade In" },
  { value: "slideLeft", label: "Slide Left" },
  { value: "slideRight", label: "Slide Right" },
  { value: "slideUp", label: "Slide Up" },
  { value: "slideDown", label: "Slide Down" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "bounceIn", label: "Bounce In" },
  { value: "rotateIn", label: "Rotate In" },
  { value: "blurIn", label: "Blur In" },
  { value: "wipeIn", label: "Wipe In" },
] as const;

export const EXIT_OPTIONS: readonly AnimationOption<ExitAnimation>[] = [
  { value: "none", label: "None" },
  { value: "fadeOut", label: "Fade Out" },
  { value: "slideLeft", label: "Slide Left" },
  { value: "slideRight", label: "Slide Right" },
  { value: "slideUp", label: "Slide Up" },
  { value: "slideDown", label: "Slide Down" },
  { value: "zoomOut", label: "Zoom Out" },
  { value: "blurOut", label: "Blur Out" },
] as const;

export const LOOP_OPTIONS: readonly AnimationOption<LoopAnimation>[] = [
  { value: "none", label: "None" },
  { value: "pulse", label: "Pulse" },
  { value: "float", label: "Float" },
  { value: "shake", label: "Shake" },
  { value: "rotate", label: "Rotate" },
  { value: "glow", label: "Glow" },
] as const;

export const EASING_OPTIONS: readonly AnimationOption<Easing>[] = [
  { value: "linear", label: "Linear" },
  { value: "ease", label: "Smooth" },
  { value: "easeIn", label: "Ease In" },
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In Out" },
  { value: "easeOutBack", label: "Overshoot" },
  { value: "easeOutElastic", label: "Elastic" },
  { value: "easeOutBounce", label: "Bounce" },
] as const;

// ---------------------------------------------------------------------------
// Typography presets
// ---------------------------------------------------------------------------

export interface TypographyPreset {
  id: "heading" | "subheading" | "body" | "caption" | "cta";
  label: string;
  description: string;
  /** Fraction of canvas width, so a preset reads the same at 1080 or 1920. */
  sizeRatio: number;
  properties: Omit<TextProperties, "text" | "fontSize">;
}

const baseText: Omit<TextProperties, "text" | "fontSize" | "fontWeight" | "letterSpacing" | "lineHeight" | "textTransform"> = {
  fontFamily: "Inter",
  fontStyle: "normal",
  align: "center",
  color: "#ffffff",
  backgroundRadius: 0,
  paddingX: 0,
  paddingY: 0,
};

export const TYPOGRAPHY_PRESETS: readonly TypographyPreset[] = [
  {
    id: "heading",
    label: "Heading",
    description: "Bold statement type",
    sizeRatio: 0.11,
    properties: { ...baseText, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, textTransform: "none" },
  },
  {
    id: "subheading",
    label: "Subheading",
    description: "Supporting headline",
    sizeRatio: 0.062,
    properties: { ...baseText, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.5, textTransform: "none" },
  },
  {
    id: "body",
    label: "Body",
    description: "Readable paragraph",
    sizeRatio: 0.04,
    properties: { ...baseText, fontWeight: 400, lineHeight: 1.45, letterSpacing: 0, textTransform: "none" },
  },
  {
    id: "caption",
    label: "Caption",
    description: "Small tracked label",
    sizeRatio: 0.026,
    properties: { ...baseText, fontWeight: 600, lineHeight: 1.3, letterSpacing: 6, textTransform: "uppercase" },
  },
  {
    id: "cta",
    label: "Call to action",
    description: "Pill button with label",
    sizeRatio: 0.038,
    properties: {
      ...baseText,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: 1,
      textTransform: "uppercase",
      backgroundColor: "#ffffff",
      color: "#0b0713",
      backgroundRadius: 999,
      paddingX: 56,
      paddingY: 28,
    },
  },
] as const;

export const FONT_FAMILIES = [
  "Inter",
  "Lexend",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Impact",
] as const;

export const FONT_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extrabold" },
  { value: 900, label: "Black" },
] as const;

// ---------------------------------------------------------------------------
// Element presets
// ---------------------------------------------------------------------------

export interface ShapePreset {
  id: string;
  label: string;
  properties: ShapeProperties;
  /** Fractions of canvas width/height used when the element is dropped in. */
  sizeRatio: { w: number; h: number };
}

export const SHAPE_PRESETS: readonly ShapePreset[] = [
  { id: "rectangle", label: "Rectangle", sizeRatio: { w: 0.5, h: 0.2 }, properties: { kind: "rectangle", fill: "#7c3aed", strokeWidth: 0, cornerRadius: 0 } },
  { id: "roundedRect", label: "Rounded", sizeRatio: { w: 0.5, h: 0.2 }, properties: { kind: "roundedRect", fill: "#ec4899", strokeWidth: 0, cornerRadius: 32 } },
  { id: "circle", label: "Circle", sizeRatio: { w: 0.35, h: 0.35 }, properties: { kind: "circle", fill: "#22d3ee", strokeWidth: 0, cornerRadius: 0 } },
  { id: "triangle", label: "Triangle", sizeRatio: { w: 0.32, h: 0.3 }, properties: { kind: "triangle", fill: "#f59e0b", strokeWidth: 0, cornerRadius: 0 } },
  { id: "star", label: "Star", sizeRatio: { w: 0.3, h: 0.3 }, properties: { kind: "star", fill: "#facc15", strokeWidth: 0, cornerRadius: 0 } },
  { id: "line", label: "Line", sizeRatio: { w: 0.55, h: 0.006 }, properties: { kind: "line", fill: "#ffffff", strokeWidth: 0, cornerRadius: 0 } },
  { id: "arrow", label: "Arrow", sizeRatio: { w: 0.4, h: 0.06 }, properties: { kind: "arrow", fill: "#ffffff", strokeWidth: 0, cornerRadius: 0 } },
] as const;

/** Decorative gradient/glow elements offered in the Elements panel. */
export const DECORATIVE_PRESETS = [
  { id: "blob-violet", label: "Violet Bloom", kind: "blob" as const, from: "#7c3aed", to: "#ec4899", blur: 90 },
  { id: "blob-cyan", label: "Cyan Bloom", kind: "blob" as const, from: "#06b6d4", to: "#3b82f6", blur: 90 },
  { id: "blob-amber", label: "Amber Glow", kind: "blob" as const, from: "#f59e0b", to: "#ef4444", blur: 80 },
  { id: "ramp-violet", label: "Violet Ramp", kind: "linear" as const, from: "#4c1d95", to: "#0b0713", blur: 0 },
  { id: "ramp-sunset", label: "Sunset Ramp", kind: "linear" as const, from: "#f97316", to: "#be123c", blur: 0 },
  { id: "radial-spot", label: "Spotlight", kind: "radial" as const, from: "#ffffff", to: "#0b0713", blur: 20 },
] as const;

/** Lucide icon names offered in the Elements panel — an allow-list, so a
 *  project document can never name an arbitrary component. */
export const ICON_LIBRARY = [
  "sparkles", "star", "heart", "zap", "flame", "award", "crown", "gift",
  "rocket", "trophy", "target", "bell", "tag", "percent", "shopping-bag", "shopping-cart",
  "calendar", "clock", "map-pin", "phone", "mail", "globe", "users", "user",
  "check", "check-circle", "arrow-right", "arrow-up-right", "play", "music", "camera", "video",
  "code", "cpu", "database", "wifi", "smartphone", "laptop", "headphones", "coffee",
  "utensils", "pizza", "graduation-cap", "book-open", "lightbulb", "megaphone", "thumbs-up", "quote",
] as const;

export type IconName = (typeof ICON_LIBRARY)[number];

export function isKnownIcon(name: string): name is IconName {
  return (ICON_LIBRARY as readonly string[]).includes(name);
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

export const BACKGROUND_PRESETS: readonly { id: string; label: string; background: Background }[] = [
  { id: "ink", label: "Ink", background: { type: "solid", value: "#07060c" } },
  { id: "charcoal", label: "Charcoal", background: { type: "solid", value: "#16151c" } },
  { id: "paper", label: "Paper", background: { type: "solid", value: "#f5f3ef" } },
  { id: "violet-night", label: "Violet Night", background: { type: "gradient", from: "#2e1065", to: "#07060c", angle: 160 } },
  { id: "aurora", label: "Aurora", background: { type: "gradient", from: "#0f172a", to: "#4c1d95", angle: 140 } },
  { id: "sunset", label: "Sunset", background: { type: "gradient", from: "#f97316", to: "#7c2d12", angle: 165 } },
  { id: "mint", label: "Mint", background: { type: "gradient", from: "#0f766e", to: "#052e2b", angle: 150 } },
  { id: "rose", label: "Rose", background: { type: "gradient", from: "#9d174d", to: "#1f0a17", angle: 155 } },
] as const;

// ---------------------------------------------------------------------------
// Layer factory helpers
// ---------------------------------------------------------------------------

export interface LayerFactoryContext {
  canvasWidth: number;
  canvasHeight: number;
  /** Where the new layer should sit on the timeline. */
  startTime: number;
  duration: number;
  zIndex: number;
  id: string;
}

const defaultAnimation = {
  enter: { type: "fadeIn" as const, duration: 0.5, delay: 0, easing: "easeOut" as const, intensity: 1 },
};

function baseLayer(ctx: LayerFactoryContext, width: number, height: number) {
  return {
    id: ctx.id,
    startTime: ctx.startTime,
    duration: ctx.duration,
    zIndex: ctx.zIndex,
    locked: false,
    hidden: false,
    blendMode: "normal" as const,
    animation: defaultAnimation,
    transform: {
      x: ctx.canvasWidth / 2,
      y: ctx.canvasHeight / 2,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    },
  };
}

/** Rough single-line text box size — good enough for initial placement; the
 *  editor measures precisely once the node mounts. */
function textBoxSize(text: string, fontSize: number, lineHeight: number, canvasWidth: number) {
  const lines = text.split("\n");
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
  const width = Math.min(canvasWidth * 0.9, Math.max(fontSize * 2, longest * fontSize * 0.56));
  const height = lines.length * fontSize * lineHeight;
  return { width, height };
}

export function createTextLayer(
  ctx: LayerFactoryContext,
  presetId: TypographyPreset["id"],
  text: string,
): Layer {
  const preset = TYPOGRAPHY_PRESETS.find((p) => p.id === presetId) ?? TYPOGRAPHY_PRESETS[0]!;
  const fontSize = Math.round(ctx.canvasWidth * preset.sizeRatio);
  const { width, height } = textBoxSize(text, fontSize, preset.properties.lineHeight, ctx.canvasWidth);
  return {
    ...baseLayer(
      ctx,
      width + preset.properties.paddingX * 2,
      height + preset.properties.paddingY * 2,
    ),
    type: "text",
    name: text.slice(0, 24) || preset.label,
    properties: { ...preset.properties, text, fontSize },
  };
}

export function createShapeLayer(ctx: LayerFactoryContext, presetId: string): Layer {
  const preset = SHAPE_PRESETS.find((p) => p.id === presetId) ?? SHAPE_PRESETS[0]!;
  return {
    ...baseLayer(
      ctx,
      Math.round(ctx.canvasWidth * preset.sizeRatio.w),
      Math.max(2, Math.round(ctx.canvasHeight * preset.sizeRatio.h)),
    ),
    type: "shape",
    name: preset.label,
    properties: preset.properties,
  };
}

export function createIconLayer(ctx: LayerFactoryContext, name: string): Layer {
  const size = Math.round(ctx.canvasWidth * 0.18);
  return {
    ...baseLayer(ctx, size, size),
    type: "icon",
    name: name.replace(/-/g, " "),
    properties: { name: isKnownIcon(name) ? name : "sparkles", color: "#ffffff", strokeWidth: 2 },
  };
}

export function createGradientLayer(ctx: LayerFactoryContext, presetId: string): Layer {
  const preset = DECORATIVE_PRESETS.find((p) => p.id === presetId) ?? DECORATIVE_PRESETS[0]!;
  return {
    ...baseLayer(ctx, Math.round(ctx.canvasWidth * 0.7), Math.round(ctx.canvasWidth * 0.7)),
    type: "gradient",
    name: preset.label,
    properties: { kind: preset.kind, from: preset.from, to: preset.to, angle: 135, blur: preset.blur },
  };
}

/**
 * Places a media layer so it fits inside the canvas while preserving its
 * intrinsic aspect ratio — the behaviour §13 asks for on insert.
 */
export function createMediaLayer(
  ctx: LayerFactoryContext,
  kind: "image" | "video",
  src: string,
  name: string,
  intrinsic?: { width: number; height: number },
): Layer {
  const maxW = ctx.canvasWidth * 0.8;
  const maxH = ctx.canvasHeight * 0.6;
  const ratio = intrinsic && intrinsic.height > 0 ? intrinsic.width / intrinsic.height : 16 / 9;
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }

  const common = baseLayer(ctx, Math.round(width), Math.round(height));
  if (kind === "video") {
    return {
      ...common,
      type: "video",
      name,
      properties: { src, fit: "cover", cornerRadius: 0, volume: 0, muted: true, trimStart: 0, playbackRate: 1 },
    };
  }
  return {
    ...common,
    type: "image",
    name,
    properties: { src, fit: "cover", cornerRadius: 0, brightness: 100, contrast: 100, saturation: 100, blur: 0 },
  };
}
