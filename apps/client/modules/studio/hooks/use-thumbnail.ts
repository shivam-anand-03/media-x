"use client";

import * as React from "react";
import { resolveLayerAtTime, type ProjectDocument } from "@workspace/motion";
import { useEditorStore } from "../stores/editor-store";
import { useUpdateProjectMutation } from "../api/studio-api";

/**
 * Captures a poster frame for the dashboard.
 *
 * Drawn with a plain 2D canvas rather than by screenshotting the Konva stage:
 * the stage is scaled to the viewport and may be scrolled or partially
 * occluded, whereas this renders the document itself at a fixed thumbnail size
 * regardless of what the editor happens to be showing.
 *
 * It only covers the shapes a thumbnail needs to be recognisable — background,
 * blocks and text. It is a preview, not the renderer; the real output always
 * comes from Remotion.
 */

const THUMB_WIDTH = 480;

export function useThumbnailCapture() {
  const [updateProject] = useUpdateProjectMutation();
  const lastCapture = React.useRef(0);

  /** Renders and uploads a poster frame. Throttled — this is cosmetic. */
  const capture = React.useCallback(
    async (options?: { force?: boolean }) => {
      const state = useEditorStore.getState();
      const { document: doc, projectId } = state;
      if (!doc || !projectId) return;

      const now = Date.now();
      if (!options?.force && now - lastCapture.current < 60_000) return;
      lastCapture.current = now;

      try {
        // Sample a third of the way in: past the opening fade, before the CTA.
        const dataUrl = renderThumbnail(doc, doc.canvas.duration * 0.35);
        if (dataUrl) await updateProject({ id: projectId, thumbnail: dataUrl }).unwrap();
      } catch {
        // A missing thumbnail is a cosmetic downgrade; never surface it.
      }
    },
    [updateProject],
  );

  return { capture };
}

/** Rasterises one frame of the document to a data URL. */
export function renderThumbnail(doc: ProjectDocument, time: number): string | null {
  if (typeof window === "undefined") return null;

  const scale = THUMB_WIDTH / doc.canvas.width;
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.round(doc.canvas.width * scale);
  canvas.height = Math.round(doc.canvas.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  paintBackground(ctx, doc);

  const visible = doc.layers
    .map((layer) => ({ layer, resolved: resolveLayerAtTime(layer, time) }))
    .filter((entry) => entry.resolved.visible && entry.resolved.opacity > 0.02)
    .sort((a, b) => a.layer.zIndex - b.layer.zIndex);

  for (const { layer, resolved } of visible) {
    ctx.save();
    ctx.globalAlpha = resolved.opacity;
    ctx.translate(resolved.x, resolved.y);
    ctx.rotate((resolved.rotation * Math.PI) / 180);
    ctx.scale(resolved.scaleX, resolved.scaleY);

    const w = resolved.width;
    const h = resolved.height;

    switch (layer.type) {
      case "text": {
        const p = layer.properties;
        if (p.backgroundColor) {
          ctx.fillStyle = p.backgroundColor;
          roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(p.backgroundRadius, Math.min(w, h) / 2));
          ctx.fill();
        }
        ctx.fillStyle = p.color;
        ctx.font = `${p.fontStyle === "italic" ? "italic " : ""}${p.fontWeight} ${p.fontSize}px ${p.fontFamily}, Inter, sans-serif`;
        ctx.textAlign = p.align === "left" ? "left" : p.align === "right" ? "right" : "center";
        ctx.textBaseline = "middle";

        const text = applyCase(p.text, p.textTransform);
        const lines = text.split("\n");
        const lineHeight = p.fontSize * p.lineHeight;
        const startY = -((lines.length - 1) * lineHeight) / 2;
        const x = p.align === "left" ? -w / 2 + p.paddingX : p.align === "right" ? w / 2 - p.paddingX : 0;

        lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight));
        break;
      }

      case "shape": {
        const p = layer.properties;
        ctx.fillStyle = p.fill;
        if (p.kind === "circle") {
          ctx.beginPath();
          ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          roundRect(ctx, -w / 2, -h / 2, w, h, p.kind === "roundedRect" ? p.cornerRadius : 0);
          ctx.fill();
        }
        break;
      }

      case "gradient": {
        const p = layer.properties;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
        gradient.addColorStop(0, p.from);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // Images, video and icons are skipped: they would need async decoding,
      // and the block layout alone already identifies the project.
      default:
        break;
    }

    ctx.restore();
  }

  try {
    return canvas.toDataURL("image/webp", 0.72);
  } catch {
    // A tainted canvas (cross-origin media) can't be exported.
    return null;
  }
}

function paintBackground(ctx: CanvasRenderingContext2D, doc: ProjectDocument) {
  const { width, height } = doc.canvas;
  const bg = doc.background;

  if (bg.type === "gradient") {
    const radians = ((bg.angle - 90) * Math.PI) / 180;
    const dx = Math.cos(radians) * (width / 2);
    const dy = Math.sin(radians) * (height / 2);
    const gradient = ctx.createLinearGradient(width / 2 - dx, height / 2 - dy, width / 2 + dx, height / 2 + dy);
    gradient.addColorStop(0, bg.from);
    gradient.addColorStop(1, bg.to);
    ctx.fillStyle = gradient;
  } else if (bg.type === "solid") {
    ctx.fillStyle = bg.value;
  } else {
    ctx.fillStyle = "#0b0713";
  }

  ctx.fillRect(0, 0, width, height);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function applyCase(text: string, transform: string): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}
