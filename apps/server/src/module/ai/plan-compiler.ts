import {
  isKnownIcon,
  parseProjectDocument,
  type AdvertisementPlan,
  type Background,
  type CanvasConfig,
  type Layer,
  type ProjectDocument,
} from "@workspace/motion";

/**
 * Compiles a plan into a project document.
 *
 * Entirely deterministic — no model output is ever placed, positioned or
 * animated directly. The plan supplies *words and colours*; every coordinate,
 * z-index, timing value and animation below is chosen by this code, then the
 * whole thing is run through `parseProjectDocument`. That is what §36 means by
 * "never allow raw AI output to directly mutate the editor".
 */

let counter = 0;
const nextId = (prefix: string) => `ai-${prefix}-${(counter = (counter + 1) % 100000)}`;

export function compilePlanToDocument(plan: AdvertisementPlan, canvas: CanvasConfig): ProjectDocument {
  const [primary = "#7c3aed", secondary = "#ec4899", tertiary] = plan.palette;
  const light = plan.backgroundStyle === "light";
  const ink = light ? "#0c0a09" : "#ffffff";
  const muted = light ? "#57534e" : withSoftAlpha(secondary);

  const background = buildBackground(plan, primary, secondary);

  // Divide the runtime: a title scene, one beat per plan scene, and a CTA.
  const sceneCount = plan.scenes.length;
  const ctaDuration = Math.min(2.4, canvas.duration * 0.22);
  const titleDuration = Math.min(3.2, canvas.duration * 0.32);
  const bodyTotal = Math.max(1, canvas.duration - titleDuration - ctaDuration);
  const beat = bodyTotal / sceneCount;

  const layers: Layer[] = [];
  const scenes: ProjectDocument["scenes"] = [];
  let z = 0;

  const push = (layer: Omit<Layer, "zIndex">) => {
    layers.push({ ...layer, zIndex: z++ } as Layer);
  };

  // --- Ambient background blooms -------------------------------------------
  push(
    gradientLayer(nextId("glow"), primary, canvas, {
      x: canvas.width * 0.22,
      y: canvas.height * 0.2,
      size: canvas.width * 1.35,
      startTime: 0,
      duration: canvas.duration,
    }),
  );
  push(
    gradientLayer(nextId("glow"), secondary, canvas, {
      x: canvas.width * 0.82,
      y: canvas.height * 0.8,
      size: canvas.width * 1.1,
      startTime: 0,
      duration: canvas.duration,
    }),
  );

  // --- Title scene ----------------------------------------------------------
  scenes.push({
    id: nextId("scene"),
    name: "Opening",
    startTime: 0,
    duration: titleDuration,
    transition: { type: "fade", duration: 0.4, easing: "easeInOut", direction: "left" },
  });

  push(
    textLayer(nextId("txt"), plan.headline.toUpperCase(), canvas, {
      y: 0.42,
      fontSize: fitFontSize(plan.headline, canvas.width, 0.115),
      weight: 800,
      color: ink,
      lineHeight: 1.02,
      letterSpacing: -2,
      startTime: 0.2,
      duration: titleDuration - 0.2,
      enter: "zoomIn",
      enterDuration: 0.8,
      easing: "easeOutBack",
      exit: "fadeOut",
    }),
  );

  if (plan.subheadline) {
    push(
      textLayer(nextId("txt"), plan.subheadline, canvas, {
        y: 0.56,
        fontSize: fitFontSize(plan.subheadline, canvas.width, 0.045),
        weight: 500,
        color: muted,
        lineHeight: 1.25,
        letterSpacing: 0,
        startTime: 0.9,
        duration: Math.max(0.5, titleDuration - 1.1),
        enter: "slideUp",
        enterDuration: 0.6,
        exit: "fadeOut",
      }),
    );
  }

  // --- One beat per planned scene ------------------------------------------
  plan.scenes.forEach((scene, index) => {
    const start = titleDuration + beat * index;
    scenes.push({
      id: nextId("scene"),
      name: scene.title.slice(0, 40) || `Scene ${index + 2}`,
      startTime: round(start),
      duration: round(beat),
      transition: {
        type: index % 2 === 0 ? "slide" : "fade",
        duration: 0.4,
        easing: "easeInOut",
        direction: "left",
      },
    });

    if (scene.icon && isKnownIcon(scene.icon)) {
      push(
        iconLayer(nextId("icn"), scene.icon, tertiary ?? primary, canvas, {
          y: 0.3,
          startTime: round(start + 0.15),
          duration: round(beat - 0.3),
        }),
      );
    }

    if (scene.caption) {
      push(
        textLayer(nextId("txt"), scene.caption.toUpperCase(), canvas, {
          y: 0.4,
          fontSize: Math.round(canvas.width * 0.026),
          weight: 600,
          color: primary,
          lineHeight: 1.3,
          letterSpacing: 6,
          startTime: round(start + 0.2),
          duration: round(beat - 0.4),
          enter: "fadeIn",
          enterDuration: 0.4,
          exit: "fadeOut",
        }),
      );
    }

    push(
      textLayer(nextId("txt"), scene.title, canvas, {
        y: scene.icon ? 0.5 : 0.46,
        fontSize: fitFontSize(scene.title, canvas.width, 0.072),
        weight: 700,
        color: ink,
        lineHeight: 1.08,
        letterSpacing: -1,
        startTime: round(start + 0.25),
        duration: round(beat - 0.45),
        enter: index % 2 === 0 ? "slideLeft" : "slideUp",
        enterDuration: 0.55,
        exit: "fadeOut",
      }),
    );

    if (scene.body) {
      push(
        textLayer(nextId("txt"), scene.body, canvas, {
          y: 0.62,
          fontSize: fitFontSize(scene.body, canvas.width, 0.036),
          weight: 400,
          color: muted,
          lineHeight: 1.4,
          letterSpacing: 0,
          startTime: round(start + 0.45),
          duration: round(beat - 0.65),
          enter: "fadeIn",
          enterDuration: 0.5,
          exit: "fadeOut",
        }),
      );
    }
  });

  // --- CTA ------------------------------------------------------------------
  const ctaStart = round(canvas.duration - ctaDuration);
  scenes.push({
    id: nextId("scene"),
    name: "Call to action",
    startTime: ctaStart,
    duration: round(ctaDuration),
    transition: { type: "zoom", duration: 0.4, easing: "easeOut", direction: "left" },
  });

  push({
    id: nextId("cta"),
    type: "text",
    name: plan.cta,
    startTime: round(ctaStart + 0.2),
    duration: round(ctaDuration - 0.2),
    locked: false,
    hidden: false,
    blendMode: "normal",
    animation: {
      enter: { type: "bounceIn", duration: 0.6, delay: 0, easing: "easeOutBack", intensity: 1 },
      loop: { type: "pulse", duration: 1.6, delay: 0, easing: "easeInOut", intensity: 1 },
    },
    transform: {
      x: canvas.width / 2,
      y: canvas.height * 0.52,
      width: Math.min(canvas.width * 0.82, plan.cta.length * canvas.width * 0.026 + canvas.width * 0.12),
      height: Math.round(canvas.width * 0.11),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    },
    properties: {
      text: plan.cta,
      fontFamily: "Inter",
      fontSize: Math.round(canvas.width * 0.038),
      fontWeight: 700,
      fontStyle: "normal",
      textTransform: "uppercase",
      align: "center",
      color: light ? "#fafafa" : "#0b0713",
      lineHeight: 1.2,
      letterSpacing: 1,
      backgroundColor: light ? primary : "#ffffff",
      backgroundRadius: 999,
      paddingX: Math.round(canvas.width * 0.05),
      paddingY: Math.round(canvas.width * 0.026),
    },
  } as Layer);

  // The final parse is the guard: if anything above produced an out-of-range
  // value, this throws rather than persisting a document the renderer can't read.
  return parseProjectDocument({
    version: 1,
    canvas,
    background,
    layers,
    audioTracks: [],
    scenes,
    palette: plan.palette,
  });
}

// ---------------------------------------------------------------------------

function buildBackground(plan: AdvertisementPlan, primary: string, secondary: string): Background {
  if (plan.backgroundStyle === "light") return { type: "solid", value: "#f5f3ef" };
  if (plan.backgroundStyle === "dark") return { type: "solid", value: "#07060c" };
  return { type: "gradient", from: darken(primary), to: "#05030c", angle: 165 };
}

/** Shrinks type for long strings so a headline can't overflow the canvas. */
function fitFontSize(text: string, canvasWidth: number, ratio: number): number {
  const longestLine = text.split("\n").reduce((m, l) => Math.max(m, l.length), 1);
  const ideal = canvasWidth * ratio;
  // ~0.56em average glyph width; keep the box inside 88% of the canvas.
  const maxForWidth = (canvasWidth * 0.88) / (longestLine * 0.56);
  return Math.max(12, Math.round(Math.min(ideal, maxForWidth)));
}

interface TextOptions {
  y: number;
  fontSize: number;
  weight: number;
  color: string;
  lineHeight: number;
  letterSpacing: number;
  startTime: number;
  duration: number;
  enter?: "fadeIn" | "slideUp" | "slideLeft" | "zoomIn" | "bounceIn";
  enterDuration?: number;
  easing?: "easeOut" | "easeOutBack";
  exit?: "fadeOut";
}

function textLayer(id: string, text: string, canvas: CanvasConfig, o: TextOptions): Omit<Layer, "zIndex"> {
  const lines = text.split("\n");
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
  return {
    id,
    type: "text",
    name: text.slice(0, 24) || "Text",
    startTime: Math.max(0, round(o.startTime)),
    duration: Math.max(0.2, round(o.duration)),
    locked: false,
    hidden: false,
    blendMode: "normal",
    animation: {
      ...(o.enter
        ? { enter: { type: o.enter, duration: o.enterDuration ?? 0.6, delay: 0, easing: o.easing ?? "easeOut", intensity: 1 } }
        : {}),
      ...(o.exit ? { exit: { type: o.exit, duration: 0.4, delay: 0, easing: "easeIn", intensity: 1 } } : {}),
    },
    transform: {
      x: canvas.width / 2,
      y: canvas.height * o.y,
      width: Math.min(canvas.width * 0.9, Math.max(o.fontSize * 2, longest * o.fontSize * 0.56)),
      height: Math.max(1, lines.length * o.fontSize * o.lineHeight),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    },
    properties: {
      text,
      fontFamily: "Inter",
      fontSize: o.fontSize,
      fontWeight: o.weight,
      fontStyle: "normal",
      textTransform: "none",
      align: "center",
      color: o.color,
      lineHeight: o.lineHeight,
      letterSpacing: o.letterSpacing,
      backgroundRadius: 0,
      paddingX: 0,
      paddingY: 0,
    },
  } as Omit<Layer, "zIndex">;
}

function iconLayer(
  id: string,
  name: string,
  color: string,
  canvas: CanvasConfig,
  o: { y: number; startTime: number; duration: number },
): Omit<Layer, "zIndex"> {
  const size = Math.round(canvas.width * 0.13);
  return {
    id,
    type: "icon",
    name: name.replace(/-/g, " "),
    startTime: Math.max(0, round(o.startTime)),
    duration: Math.max(0.2, round(o.duration)),
    locked: false,
    hidden: false,
    blendMode: "normal",
    animation: {
      enter: { type: "bounceIn", duration: 0.6, delay: 0, easing: "easeOutBack", intensity: 1 },
      loop: { type: "float", duration: 3.5, delay: 0, easing: "easeInOut", intensity: 1 },
      exit: { type: "fadeOut", duration: 0.35, delay: 0, easing: "easeIn", intensity: 1 },
    },
    transform: {
      x: canvas.width / 2,
      y: canvas.height * o.y,
      width: size,
      height: size,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    },
    properties: { name, color, strokeWidth: 2 },
  } as Omit<Layer, "zIndex">;
}

function gradientLayer(
  id: string,
  color: string,
  canvas: CanvasConfig,
  o: { x: number; y: number; size: number; startTime: number; duration: number },
): Omit<Layer, "zIndex"> {
  return {
    id,
    type: "gradient",
    name: "Ambient glow",
    startTime: o.startTime,
    duration: o.duration,
    locked: false,
    hidden: false,
    blendMode: "normal",
    animation: {
      enter: { type: "fadeIn", duration: 1.2, delay: 0, easing: "easeOut", intensity: 1 },
      loop: { type: "float", duration: 10, delay: 0, easing: "easeInOut", intensity: 1 },
    },
    transform: {
      x: o.x,
      y: o.y,
      width: Math.round(o.size),
      height: Math.round(o.size),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 0.75,
    },
    properties: { kind: "blob", from: color, to: "#05030c", angle: 135, blur: 90 },
  } as Omit<Layer, "zIndex">;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Pulls a hex colour toward black so it works as a gradient anchor. */
function darken(hex: string): string {
  const normalized = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const value = parseInt(normalized.slice(1, 7), 16);
  if (Number.isNaN(value)) return "#1e1065";
  const r = Math.round(((value >> 16) & 255) * 0.42);
  const g = Math.round(((value >> 8) & 255) * 0.42);
  const b = Math.round((value & 255) * 0.42);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function withSoftAlpha(hex: string): string {
  const normalized = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7);
  // A lifted tint reads better than transparency on an unknown background.
  const value = parseInt(normalized.slice(1, 7), 16);
  if (Number.isNaN(value)) return "#e9d5ff";
  const mix = (channel: number) => Math.round(channel + (255 - channel) * 0.6);
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
