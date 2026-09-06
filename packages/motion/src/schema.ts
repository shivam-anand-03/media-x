import { z } from "zod";

/**
 * The canonical advertisement document.
 *
 * This schema is the contract between the three things that must never
 * disagree: the editor (what the user manipulates), the preview (what they
 * check) and the Remotion renderer (what actually gets encoded). It is also
 * the trust boundary — project JSON arriving from a browser is parsed through
 * `projectDocumentSchema` before it is persisted or rendered, so a malformed
 * or hostile document can never reach the render worker.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** `#rgb`, `#rrggbb` or `#rrggbbaa`. Kept strict so the renderer never has to
 *  guess at a CSS colour string it cannot parse. */
export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Invalid hex colour");

/** Assets are referenced by URL. Only http(s) and data URLs are accepted: this
 *  is what stops a project document from pointing the render worker at
 *  `file:///etc/passwd` or an internal `http://169.254.169.254` style address
 *  is separately blocked at fetch time in the worker. */
export const assetUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (value) => /^https?:\/\//i.test(value) || /^data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(value),
    "Asset URL must be an http(s) or base64 data URL",
  );

export const EASINGS = [
  "linear",
  "ease",
  "easeIn",
  "easeOut",
  "easeInOut",
  "easeOutBack",
  "easeOutElastic",
  "easeOutBounce",
] as const;
export const easingSchema = z.enum(EASINGS);
export type Easing = z.infer<typeof easingSchema>;

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "soft-light",
  "hard-light",
  "difference",
  "exclusion",
] as const;
export const blendModeSchema = z.enum(BLEND_MODES);
export type BlendMode = z.infer<typeof blendModeSchema>;

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/**
 * `x`/`y` are the centre of the layer in canvas pixels, and `width`/`height`
 * its untransformed box. Anchoring on the centre is what makes rotation and
 * scale animations behave the way a designer expects without every consumer
 * re-deriving an origin.
 */
export const transformSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  scaleX: z.number().finite().min(-100).max(100).default(1),
  scaleY: z.number().finite().min(-100).max(100).default(1),
  rotation: z.number().finite().default(0),
  opacity: z.number().min(0).max(1).default(1),
});
export type Transform = z.infer<typeof transformSchema>;

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export const ENTRANCE_ANIMATIONS = [
  "none",
  "fadeIn",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "zoomIn",
  "bounceIn",
  "rotateIn",
  "blurIn",
  "wipeIn",
] as const;
export const entranceAnimationSchema = z.enum(ENTRANCE_ANIMATIONS);
export type EntranceAnimation = z.infer<typeof entranceAnimationSchema>;

export const EXIT_ANIMATIONS = [
  "none",
  "fadeOut",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "zoomOut",
  "blurOut",
] as const;
export const exitAnimationSchema = z.enum(EXIT_ANIMATIONS);
export type ExitAnimation = z.infer<typeof exitAnimationSchema>;

export const LOOP_ANIMATIONS = ["none", "pulse", "float", "shake", "rotate", "glow"] as const;
export const loopAnimationSchema = z.enum(LOOP_ANIMATIONS);
export type LoopAnimation = z.infer<typeof loopAnimationSchema>;

/**
 * `intensity` scales how far an animation travels (a slide's distance, a
 * zoom's starting scale). Keeping it as one normalised 0–2 knob means the
 * inspector exposes a single slider instead of per-animation magic numbers.
 */
const animationBaseSchema = {
  duration: z.number().min(0).max(10).default(0.6),
  delay: z.number().min(0).max(60).default(0),
  easing: easingSchema.default("easeOut"),
  intensity: z.number().min(0).max(2).default(1),
};

export const entranceConfigSchema = z.object({
  type: entranceAnimationSchema.default("none"),
  ...animationBaseSchema,
});
export type EntranceConfig = z.infer<typeof entranceConfigSchema>;

export const exitConfigSchema = z.object({
  type: exitAnimationSchema.default("none"),
  ...animationBaseSchema,
});
export type ExitConfig = z.infer<typeof exitConfigSchema>;

export const loopConfigSchema = z.object({
  type: loopAnimationSchema.default("none"),
  // Up to a minute: slow ambient rotations/drifts are a real technique, and a
  // tight cap here silently rejects otherwise valid templates.
  duration: z.number().min(0.1).max(60).default(2),
  delay: z.number().min(0).max(60).default(0),
  easing: easingSchema.default("easeInOut"),
  intensity: z.number().min(0).max(2).default(1),
});
export type LoopConfig = z.infer<typeof loopConfigSchema>;

export const layerAnimationSchema = z.object({
  enter: entranceConfigSchema.optional(),
  exit: exitConfigSchema.optional(),
  loop: loopConfigSchema.optional(),
});
export type LayerAnimation = z.infer<typeof layerAnimationSchema>;

// ---------------------------------------------------------------------------
// Layer properties, discriminated by layer type
// ---------------------------------------------------------------------------

export const LAYER_TYPES = ["text", "image", "video", "shape", "icon", "gradient"] as const;
export const layerTypeSchema = z.enum(LAYER_TYPES);
export type LayerType = z.infer<typeof layerTypeSchema>;

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export const textPropertiesSchema = z.object({
  text: z.string().max(2000).default("Text"),
  fontFamily: z.string().max(120).default("Inter"),
  fontSize: z.number().min(1).max(2000).default(64),
  fontWeight: z.number().int().min(100).max(900).default(700),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).default("none"),
  align: z.enum(TEXT_ALIGNS).default("center"),
  color: hexColorSchema.default("#ffffff"),
  lineHeight: z.number().min(0.5).max(4).default(1.15),
  letterSpacing: z.number().min(-50).max(200).default(0),
  /** Optional pill/box behind the text — how CTA buttons are expressed. */
  backgroundColor: hexColorSchema.optional(),
  backgroundRadius: z.number().min(0).max(9999).default(0),
  paddingX: z.number().min(0).max(400).default(0),
  paddingY: z.number().min(0).max(400).default(0),
});
export type TextProperties = z.infer<typeof textPropertiesSchema>;

export const imagePropertiesSchema = z.object({
  src: assetUrlSchema,
  /** Object-fit semantics, matched between Konva and the DOM renderer. */
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  cornerRadius: z.number().min(0).max(2000).default(0),
  /** Percentages, so 100 is "unchanged" for all three. */
  brightness: z.number().min(0).max(300).default(100),
  contrast: z.number().min(0).max(300).default(100),
  saturation: z.number().min(0).max(300).default(100),
  blur: z.number().min(0).max(100).default(0),
});
export type ImageProperties = z.infer<typeof imagePropertiesSchema>;

export const videoPropertiesSchema = z.object({
  src: assetUrlSchema,
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  cornerRadius: z.number().min(0).max(2000).default(0),
  volume: z.number().min(0).max(1).default(0),
  muted: z.boolean().default(true),
  /** Seconds into the source file that this clip starts from. */
  trimStart: z.number().min(0).max(3600).default(0),
  playbackRate: z.number().min(0.25).max(4).default(1),
});
export type VideoProperties = z.infer<typeof videoPropertiesSchema>;

export const SHAPE_KINDS = ["rectangle", "roundedRect", "circle", "line", "arrow", "triangle", "star"] as const;
export const shapePropertiesSchema = z.object({
  kind: z.enum(SHAPE_KINDS).default("rectangle"),
  fill: hexColorSchema.default("#7c3aed"),
  stroke: hexColorSchema.optional(),
  strokeWidth: z.number().min(0).max(200).default(0),
  cornerRadius: z.number().min(0).max(2000).default(0),
});
export type ShapeProperties = z.infer<typeof shapePropertiesSchema>;

export const iconPropertiesSchema = z.object({
  /** Lucide icon name; resolved through an allow-list at render time. */
  name: z.string().max(64).default("sparkles"),
  color: hexColorSchema.default("#ffffff"),
  strokeWidth: z.number().min(0.5).max(6).default(2),
});
export type IconProperties = z.infer<typeof iconPropertiesSchema>;

export const gradientPropertiesSchema = z.object({
  /** `blob` is a soft radial bloom; `linear` a straight two-stop ramp. */
  kind: z.enum(["linear", "radial", "blob"]).default("blob"),
  from: hexColorSchema.default("#7c3aed"),
  to: hexColorSchema.default("#ec4899"),
  angle: z.number().min(0).max(360).default(135),
  blur: z.number().min(0).max(400).default(60),
});
export type GradientProperties = z.infer<typeof gradientPropertiesSchema>;

/**
 * Layers are a discriminated union on `type` so that `properties` is exactly
 * typed per kind — the inspector can then render contextual controls with no
 * casting, and an `image` layer can never be persisted without a `src`.
 */
const layerCommon = {
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  /** Seconds from the start of the advertisement. */
  startTime: z.number().min(0).max(600).default(0),
  duration: z.number().min(0.1).max(600).default(3),
  zIndex: z.number().int().min(0).max(10000).default(0),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  transform: transformSchema,
  animation: layerAnimationSchema.default({}),
  blendMode: blendModeSchema.default("normal"),
  /** Set when the layer belongs to a scene; free layers leave it undefined. */
  sceneId: z.string().max(64).optional(),
};

export const layerSchema = z.discriminatedUnion("type", [
  z.object({ ...layerCommon, type: z.literal("text"), properties: textPropertiesSchema }),
  z.object({ ...layerCommon, type: z.literal("image"), properties: imagePropertiesSchema }),
  z.object({ ...layerCommon, type: z.literal("video"), properties: videoPropertiesSchema }),
  z.object({ ...layerCommon, type: z.literal("shape"), properties: shapePropertiesSchema }),
  z.object({ ...layerCommon, type: z.literal("icon"), properties: iconPropertiesSchema }),
  z.object({ ...layerCommon, type: z.literal("gradient"), properties: gradientPropertiesSchema }),
]);
export type Layer = z.infer<typeof layerSchema>;

export type LayerOfType<T extends LayerType> = Extract<Layer, { type: T }>;
export type TextLayer = LayerOfType<"text">;
export type ImageLayer = LayerOfType<"image">;
export type VideoLayer = LayerOfType<"video">;
export type ShapeLayer = LayerOfType<"shape">;
export type IconLayer = LayerOfType<"icon">;
export type GradientLayer = LayerOfType<"gradient">;

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export const audioTrackSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  src: assetUrlSchema,
  kind: z.enum(["music", "sfx", "voiceover"]).default("music"),
  /** Position on the advertisement timeline. */
  startTime: z.number().min(0).max(600).default(0),
  duration: z.number().min(0.1).max(600).default(10),
  /** Offset into the source file, so a clip can be trimmed from the head. */
  trimStart: z.number().min(0).max(3600).default(0),
  volume: z.number().min(0).max(1).default(0.8),
  fadeIn: z.number().min(0).max(30).default(0),
  fadeOut: z.number().min(0).max(30).default(0),
  muted: z.boolean().default(false),
  locked: z.boolean().default(false),
});
export type AudioTrack = z.infer<typeof audioTrackSchema>;

// ---------------------------------------------------------------------------
// Scenes and transitions
// ---------------------------------------------------------------------------

export const TRANSITION_TYPES = ["none", "fade", "slide", "zoom", "blur", "wipe"] as const;
export const transitionSchema = z.object({
  type: z.enum(TRANSITION_TYPES).default("none"),
  duration: z.number().min(0).max(5).default(0.5),
  easing: easingSchema.default("easeInOut"),
  direction: z.enum(["left", "right", "up", "down"]).default("left"),
});
export type Transition = z.infer<typeof transitionSchema>;

export const sceneSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  startTime: z.number().min(0).max(600),
  duration: z.number().min(0.1).max(600),
  /** Transition played *into* this scene. */
  transition: transitionSchema.default({
    type: "none",
    duration: 0.5,
    easing: "easeInOut",
    direction: "left",
  }),
});
export type Scene = z.infer<typeof sceneSchema>;

// ---------------------------------------------------------------------------
// Canvas and background
// ---------------------------------------------------------------------------

export const canvasSchema = z.object({
  width: z.number().int().min(64).max(4096),
  height: z.number().int().min(64).max(4096),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).default(30),
  duration: z.number().min(0.5).max(600).default(10),
});
export type CanvasConfig = z.infer<typeof canvasSchema>;

export const backgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), value: hexColorSchema }),
  z.object({
    type: z.literal("gradient"),
    from: hexColorSchema,
    to: hexColorSchema,
    angle: z.number().min(0).max(360).default(160),
  }),
  z.object({ type: z.literal("image"), src: assetUrlSchema, fit: z.enum(["cover", "contain"]).default("cover") }),
]);
export type Background = z.infer<typeof backgroundSchema>;

// ---------------------------------------------------------------------------
// Project document
// ---------------------------------------------------------------------------

export const PROJECT_SCHEMA_VERSION = 1 as const;

/** Hard ceilings that bound the render worker's cost per job. */
export const PROJECT_LIMITS = {
  maxLayers: 200,
  maxAudioTracks: 24,
  maxScenes: 40,
  maxDurationSeconds: 300,
} as const;

export const projectDocumentSchema = z
  .object({
    version: z.literal(PROJECT_SCHEMA_VERSION).default(PROJECT_SCHEMA_VERSION),
    canvas: canvasSchema,
    background: backgroundSchema,
    layers: z.array(layerSchema).max(PROJECT_LIMITS.maxLayers).default([]),
    audioTracks: z.array(audioTrackSchema).max(PROJECT_LIMITS.maxAudioTracks).default([]),
    scenes: z.array(sceneSchema).max(PROJECT_LIMITS.maxScenes).default([]),
    /** Swatches surfaced in the colour picker as "project colours". */
    palette: z.array(hexColorSchema).max(24).default([]),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (const layer of doc.layers) {
      if (ids.has(layer.id)) {
        ctx.addIssue({ code: "custom", path: ["layers"], message: `Duplicate layer id: ${layer.id}` });
      }
      ids.add(layer.id);
    }
    const audioIds = new Set<string>();
    for (const track of doc.audioTracks) {
      if (audioIds.has(track.id)) {
        ctx.addIssue({ code: "custom", path: ["audioTracks"], message: `Duplicate audio id: ${track.id}` });
      }
      audioIds.add(track.id);
    }
  });

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

/**
 * Parses untrusted project JSON. Everything that persists or renders a
 * document goes through here — never trust the shape the client sent.
 */
export function parseProjectDocument(input: unknown): ProjectDocument {
  return projectDocumentSchema.parse(input);
}

export function safeParseProjectDocument(input: unknown) {
  return projectDocumentSchema.safeParse(input);
}
