import type {
  Easing,
  EntranceConfig,
  ExitConfig,
  Layer,
  LoopConfig,
  Transition,
} from "./schema.js";

/**
 * The animation engine.
 *
 * `resolveLayerAtTime` is the single place where "what does this layer look
 * like right now" is decided. The editor canvas, the preview player and the
 * Remotion composition all call it, which is what guarantees a preview matches
 * the exported MP4 frame for frame. It is deliberately pure and allocation-
 * light: it runs once per layer per frame, so it must stay cheap.
 */

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

const c1 = 1.70158;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const n1 = 7.5625;
const d1 = 2.75;

export const easingFunctions: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  ease: (t) => t * t * (3 - 2 * t),
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  easeOutElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1,
  easeOutBounce: (t) => {
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** CSS `transition-timing-function` equivalents, for DOM-side micro-interactions. */
export const cssEasings: Record<Easing, string> = {
  linear: "linear",
  ease: "ease",
  easeIn: "cubic-bezier(0.32, 0, 0.67, 0)",
  easeOut: "cubic-bezier(0.33, 1, 0.68, 1)",
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  easeOutBack: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  easeOutElastic: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeOutBounce: "cubic-bezier(0.22, 1.2, 0.36, 1)",
};

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** Applies an easing curve to a 0–1 progress value, clamping first. */
export function ease(progress: number, easing: Easing): number {
  const fn = easingFunctions[easing] ?? easingFunctions.linear;
  return fn(clamp(progress, 0, 1));
}

// ---------------------------------------------------------------------------
// Resolved output
// ---------------------------------------------------------------------------

/**
 * The fully-resolved visual state of a layer at one instant. Renderers consume
 * this and nothing else — they never read `layer.animation` themselves.
 */
export interface ResolvedLayer {
  /** False when the playhead is outside the layer's timeline span. */
  visible: boolean;
  /** Centre position in canvas pixels, after animation offsets. */
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  rotation: number;
  opacity: number;
  /** CSS pixels of gaussian blur contributed by blur/wipe animations. */
  blur: number;
  /** 0–1 reveal fraction for wipe-style entrances; 1 when fully revealed. */
  clipProgress: number;
  /** Seconds since the layer appeared — video layers use it to seek. */
  localTime: number;
}

const IDENTITY_BLUR = 0;

// ---------------------------------------------------------------------------
// Entrance / exit offsets
// ---------------------------------------------------------------------------

interface Offsets {
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
  rotation: number;
  blur: number;
  clip: number;
}

const NO_OFFSET: Offsets = { dx: 0, dy: 0, scale: 1, opacity: 1, rotation: 0, blur: 0, clip: 1 };

/**
 * Slide distance is expressed relative to the layer's own size so a small
 * badge and a full-bleed image both travel a proportionate, sensible amount.
 */
function slideDistance(size: number, intensity: number): number {
  return (size * 0.6 + 120) * intensity;
}

function entranceOffsets(config: EntranceConfig, p: number, w: number, h: number): Offsets {
  const i = config.intensity;
  // `inv` is "how far from settled we still are": 1 at the start, 0 when done.
  const inv = 1 - p;
  switch (config.type) {
    case "none":
      return NO_OFFSET;
    case "fadeIn":
      return { ...NO_OFFSET, opacity: p };
    case "slideLeft":
      return { ...NO_OFFSET, opacity: p, dx: slideDistance(w, i) * inv };
    case "slideRight":
      return { ...NO_OFFSET, opacity: p, dx: -slideDistance(w, i) * inv };
    case "slideUp":
      return { ...NO_OFFSET, opacity: p, dy: slideDistance(h, i) * inv };
    case "slideDown":
      return { ...NO_OFFSET, opacity: p, dy: -slideDistance(h, i) * inv };
    case "zoomIn":
      return { ...NO_OFFSET, opacity: p, scale: lerp(1 - 0.45 * i, 1, p) };
    case "bounceIn":
      // Overshoot lives in the curve, so intensity only scales how small it starts.
      return { ...NO_OFFSET, opacity: clamp(p * 2, 0, 1), scale: lerp(1 - 0.6 * i, 1, p) };
    case "rotateIn":
      return { ...NO_OFFSET, opacity: p, rotation: -90 * i * inv, scale: lerp(1 - 0.3 * i, 1, p) };
    case "blurIn":
      return { ...NO_OFFSET, opacity: p, blur: 24 * i * inv };
    case "wipeIn":
      return { ...NO_OFFSET, clip: p };
    default:
      return NO_OFFSET;
  }
}

function exitOffsets(config: ExitConfig, p: number, w: number, h: number): Offsets {
  const i = config.intensity;
  switch (config.type) {
    case "none":
      return NO_OFFSET;
    case "fadeOut":
      return { ...NO_OFFSET, opacity: 1 - p };
    case "slideLeft":
      return { ...NO_OFFSET, opacity: 1 - p, dx: -slideDistance(w, i) * p };
    case "slideRight":
      return { ...NO_OFFSET, opacity: 1 - p, dx: slideDistance(w, i) * p };
    case "slideUp":
      return { ...NO_OFFSET, opacity: 1 - p, dy: -slideDistance(h, i) * p };
    case "slideDown":
      return { ...NO_OFFSET, opacity: 1 - p, dy: slideDistance(h, i) * p };
    case "zoomOut":
      return { ...NO_OFFSET, opacity: 1 - p, scale: lerp(1, 1 - 0.4 * i, p) };
    case "blurOut":
      return { ...NO_OFFSET, opacity: 1 - p, blur: 24 * i * p };
    default:
      return NO_OFFSET;
  }
}

/** Loop animations are driven by a free-running phase rather than progress. */
function loopOffsets(config: LoopConfig, localTime: number): Offsets {
  if (config.type === "none") return NO_OFFSET;
  const elapsed = localTime - config.delay;
  if (elapsed < 0) return NO_OFFSET;

  const i = config.intensity;
  const phase = (elapsed % config.duration) / config.duration;
  const wave = Math.sin(phase * Math.PI * 2);

  switch (config.type) {
    case "pulse":
      return { ...NO_OFFSET, scale: 1 + 0.06 * i * wave };
    case "float":
      return { ...NO_OFFSET, dy: -14 * i * wave };
    case "shake":
      // Higher frequency than the others: a shake should read as a jitter.
      return { ...NO_OFFSET, dx: 6 * i * Math.sin(phase * Math.PI * 8) };
    case "rotate":
      return { ...NO_OFFSET, rotation: 360 * phase * (i || 1) };
    case "glow":
      return { ...NO_OFFSET, opacity: 1 - 0.25 * i * (0.5 + 0.5 * wave) };
    default:
      return NO_OFFSET;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves a layer's visual state at `time` (seconds from the start of the ad).
 *
 * Entrance runs forward from `startTime + enter.delay`; exit is anchored to the
 * *end* of the layer's span so it always lands exactly as the layer leaves,
 * regardless of how long the layer is on screen.
 */
export function resolveLayerAtTime(layer: Layer, time: number): ResolvedLayer {
  const { transform, animation } = layer;
  const start = layer.startTime;
  const end = layer.startTime + layer.duration;
  const localTime = time - start;

  const base: ResolvedLayer = {
    visible: !layer.hidden && time >= start && time < end,
    x: transform.x,
    y: transform.y,
    width: transform.width,
    height: transform.height,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    rotation: transform.rotation,
    opacity: transform.opacity,
    blur: IDENTITY_BLUR,
    clipProgress: 1,
    localTime: Math.max(0, localTime),
  };

  if (!base.visible) return base;

  const w = transform.width * Math.abs(transform.scaleX);
  const h = transform.height * Math.abs(transform.scaleY);

  let dx = 0;
  let dy = 0;
  let scale = 1;
  let opacity = 1;
  let rotation = 0;
  let blur = 0;
  let clip = 1;

  const apply = (o: Offsets) => {
    dx += o.dx;
    dy += o.dy;
    scale *= o.scale;
    opacity *= o.opacity;
    rotation += o.rotation;
    blur += o.blur;
    clip = Math.min(clip, o.clip);
  };

  const enter = animation.enter;
  if (enter && enter.type !== "none" && enter.duration > 0) {
    const enterStart = enter.delay;
    const p = (localTime - enterStart) / enter.duration;
    if (p < 0) {
      // Before the entrance begins the layer is staged, not yet shown.
      apply(entranceOffsets(enter, 0, w, h));
      // A staged layer must not flash at full opacity for its delay window.
      opacity *= enter.type === "wipeIn" ? 1 : 0;
      if (enter.type === "wipeIn") clip = 0;
    } else if (p < 1) {
      apply(entranceOffsets(enter, ease(p, enter.easing), w, h));
    }
  }

  const exit = animation.exit;
  if (exit && exit.type !== "none" && exit.duration > 0) {
    const exitStart = layer.duration - exit.duration - exit.delay;
    const p = (localTime - exitStart) / exit.duration;
    if (p > 0) {
      apply(exitOffsets(exit, ease(p, exit.easing), w, h));
    }
  }

  const loop = animation.loop;
  if (loop && loop.type !== "none") {
    apply(loopOffsets(loop, localTime));
  }

  base.x += dx;
  base.y += dy;
  base.scaleX = transform.scaleX * scale;
  base.scaleY = transform.scaleY * scale;
  base.rotation = transform.rotation + rotation;
  base.opacity = clamp(transform.opacity * opacity, 0, 1);
  base.blur = blur;
  base.clipProgress = clamp(clip, 0, 1);

  return base;
}

/** Volume for an audio track at `time`, honouring trim, fades and mute. */
export function resolveAudioVolumeAtTime(
  track: { startTime: number; duration: number; volume: number; fadeIn: number; fadeOut: number; muted: boolean },
  time: number,
): number {
  if (track.muted) return 0;
  const local = time - track.startTime;
  if (local < 0 || local >= track.duration) return 0;

  let gain = track.volume;
  if (track.fadeIn > 0 && local < track.fadeIn) {
    gain *= local / track.fadeIn;
  }
  const fromEnd = track.duration - local;
  if (track.fadeOut > 0 && fromEnd < track.fadeOut) {
    gain *= fromEnd / track.fadeOut;
  }
  return clamp(gain, 0, 1);
}

// ---------------------------------------------------------------------------
// Scene transitions
// ---------------------------------------------------------------------------

export interface ResolvedTransition {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  blur: number;
  clipProgress: number;
}

export const IDENTITY_TRANSITION: ResolvedTransition = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  blur: 0,
  clipProgress: 1,
};

/**
 * Resolves the incoming-scene transform for a transition at `progress` (0 = the
 * instant the scene starts, 1 = fully settled). Distances are fractions of the
 * canvas, supplied by the caller, so the same maths works at any resolution.
 */
export function resolveTransition(
  transition: Transition,
  progress: number,
  canvasWidth: number,
  canvasHeight: number,
): ResolvedTransition {
  if (transition.type === "none" || transition.duration <= 0) return IDENTITY_TRANSITION;
  const p = ease(progress, transition.easing);
  const inv = 1 - p;
  const sign = transition.direction === "left" || transition.direction === "up" ? 1 : -1;
  const horizontal = transition.direction === "left" || transition.direction === "right";

  switch (transition.type) {
    case "fade":
      return { ...IDENTITY_TRANSITION, opacity: p };
    case "slide":
      return {
        ...IDENTITY_TRANSITION,
        translateX: horizontal ? sign * canvasWidth * inv : 0,
        translateY: horizontal ? 0 : sign * canvasHeight * inv,
      };
    case "zoom":
      return { ...IDENTITY_TRANSITION, opacity: p, scale: lerp(1.18, 1, p) };
    case "blur":
      return { ...IDENTITY_TRANSITION, opacity: p, blur: 30 * inv };
    case "wipe":
      return { ...IDENTITY_TRANSITION, clipProgress: p };
    default:
      return IDENTITY_TRANSITION;
  }
}

/** The scene containing `time`, or undefined for scene-less projects. */
export function sceneAtTime<T extends { startTime: number; duration: number }>(
  scenes: readonly T[],
  time: number,
): T | undefined {
  return scenes.find((s) => time >= s.startTime && time < s.startTime + s.duration);
}
