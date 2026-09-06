import type { CSSProperties } from "react";
import {
  resolveLayerAtTime,
  type Background,
  type Layer,
  type ResolvedLayer,
} from "@workspace/motion";

/**
 * Turns a resolved layer into CSS.
 *
 * This module is the *only* place that knows how a layer becomes pixels in the
 * DOM. The preview player in the editor and the Remotion composition both use
 * it, so what a student sees before exporting and what comes out of the
 * encoder are produced by the same code path (§28, §51).
 */

/** Layers are positioned by their centre, so every box is translated by -50%. */
export function layerFrameStyle(resolved: ResolvedLayer, layer: Layer): CSSProperties {
  const transforms = [
    `translate(-50%, -50%)`,
    resolved.rotation !== 0 ? `rotate(${resolved.rotation}deg)` : "",
    resolved.scaleX !== 1 || resolved.scaleY !== 1 ? `scale(${resolved.scaleX}, ${resolved.scaleY})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style: CSSProperties = {
    position: "absolute",
    left: resolved.x,
    top: resolved.y,
    width: resolved.width,
    height: resolved.height,
    transform: transforms,
    // Scale from the centre so a zoom animation grows symmetrically.
    transformOrigin: "center center",
    opacity: resolved.opacity,
    willChange: "transform, opacity",
  };

  if (layer.blendMode !== "normal") {
    style.mixBlendMode = layer.blendMode;
  }
  if (resolved.blur > 0) {
    style.filter = `blur(${resolved.blur}px)`;
  }
  if (resolved.clipProgress < 1) {
    // Wipe reveals left-to-right by insetting the right edge.
    style.clipPath = `inset(0 ${(1 - resolved.clipProgress) * 100}% 0 0)`;
  }
  return style;
}

/** CSS for the project background. */
export function backgroundStyle(background: Background): CSSProperties {
  switch (background.type) {
    case "solid":
      return { backgroundColor: background.value };
    case "gradient":
      return { backgroundImage: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})` };
    case "image":
      return {
        backgroundImage: `url(${JSON.stringify(background.src)})`,
        backgroundSize: background.fit,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    default:
      return { backgroundColor: "#000000" };
  }
}

/** Text styling shared by the DOM renderer and the editor's inline editor. */
export function textStyle(layer: Extract<Layer, { type: "text" }>): CSSProperties {
  const p = layer.properties;
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : "center",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    padding: `${p.paddingY}px ${p.paddingX}px`,
    fontFamily: `${p.fontFamily}, Inter, system-ui, -apple-system, "Segoe UI", sans-serif`,
    fontSize: p.fontSize,
    fontWeight: p.fontWeight,
    fontStyle: p.fontStyle,
    lineHeight: p.lineHeight,
    letterSpacing: `${p.letterSpacing}px`,
    textTransform: p.textTransform === "none" ? undefined : p.textTransform,
    textAlign: p.align,
    color: p.color,
    backgroundColor: p.backgroundColor,
    borderRadius: p.backgroundRadius,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    // Text is decorative in an advert; letting the browser select it inside the
    // canvas would fight with drag-to-move.
    userSelect: "none",
  };
}

export function imageFilter(p: { brightness: number; contrast: number; saturation: number; blur: number }): string | undefined {
  const parts: string[] = [];
  if (p.brightness !== 100) parts.push(`brightness(${p.brightness}%)`);
  if (p.contrast !== 100) parts.push(`contrast(${p.contrast}%)`);
  if (p.saturation !== 100) parts.push(`saturate(${p.saturation}%)`);
  if (p.blur > 0) parts.push(`blur(${p.blur}px)`);
  return parts.length ? parts.join(" ") : undefined;
}

/** CSS background for a decorative gradient layer. */
export function gradientBackground(p: {
  kind: "linear" | "radial" | "blob";
  from: string;
  to: string;
  angle: number;
}): string {
  if (p.kind === "linear") return `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})`;
  if (p.kind === "radial") return `radial-gradient(circle at 50% 50%, ${p.from}, ${p.to})`;
  // A blob fades to fully transparent so it reads as a bloom over whatever is
  // behind it rather than a hard-edged disc.
  return `radial-gradient(circle at 50% 50%, ${p.from} 0%, ${withAlpha(p.to, 0.35)} 45%, transparent 72%)`;
}

/** Appends an alpha channel to a #rgb/#rrggbb colour. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalized}${a}`;
}

/** Layers that are on screen at `time`, ordered back to front. */
export function visibleLayersAtTime(layers: readonly Layer[], time: number): { layer: Layer; resolved: ResolvedLayer }[] {
  return layers
    .map((layer) => ({ layer, resolved: resolveLayerAtTime(layer, time) }))
    .filter((entry) => entry.resolved.visible && entry.resolved.opacity > 0.001)
    .sort((a, b) => a.layer.zIndex - b.layer.zIndex);
}
