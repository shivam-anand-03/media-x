"use client";

import * as React from "react";
import { Ellipse, Group, Image as KonvaImage, Line, Path, Rect, Text, RegularPolygon, Star } from "react-konva";
import type Konva from "konva";
import { getIconPath } from "./icon-paths";
import type { Layer, ResolvedLayer } from "@workspace/motion";
import { useEditorStore } from "../../stores/editor-store";

/**
 * Renders one layer onto the Konva stage.
 *
 * Every node is anchored on its centre (`offsetX/offsetY` at half the box) to
 * match the document's centre-based transform model, so rotation and scale
 * behave identically here, in the preview and in the exported video.
 *
 * Memoised on the resolved values rather than the layer object: during
 * playback only the handful of on-screen layers whose resolved state actually
 * changed re-render (§42).
 */

export interface CanvasLayerNodeProps {
  layer: Layer;
  resolved: ResolvedLayer;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onDragStart: (layerId: string) => void;
  onDragMove: (layerId: string, node: Konva.Node) => void;
  onDragEnd: () => void;
  interactive: boolean;
}

function CanvasLayerNodeImpl({
  layer,
  resolved,
  registerNode,
  onDragStart,
  onDragMove,
  onDragEnd,
  interactive,
}: CanvasLayerNodeProps) {
  const nodeRef = React.useRef<Konva.Group>(null);

  React.useEffect(() => {
    registerNode(layer.id, nodeRef.current);
    return () => registerNode(layer.id, null);
  }, [layer.id, registerNode]);

  const draggable = interactive && !layer.locked;

  const handleClick = React.useCallback(
    (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      event.cancelBubble = true;
      if (layer.locked) return;
      // Touch has no modifier keys, so an additive tap is simply never additive.
      const evt = event.evt as Partial<MouseEvent>;
      useEditorStore.getState().selectLayer(layer.id, {
        additive: Boolean(evt.shiftKey || evt.metaKey || evt.ctrlKey),
      });
    },
    [layer.id, layer.locked],
  );

  const handleDoubleClick = React.useCallback(() => {
    // Double-clicking text opens the inline editor; the canvas workspace
    // renders the actual textarea over the node.
    if (layer.type === "text" && !layer.locked) {
      useEditorStore.getState().setEditingTextLayer(layer.id);
    }
  }, [layer.id, layer.type, layer.locked]);

  const width = resolved.width;
  const height = resolved.height;

  // A wipe reveals left-to-right; clip in local (unrotated) space so the
  // reveal edge stays perpendicular to the layer, matching the DOM renderer.
  const clip =
    resolved.clipProgress < 1
      ? { x: 0, y: 0, width: Math.max(0.01, width * resolved.clipProgress), height }
      : undefined;

  return (
    <Group
      ref={nodeRef}
      id={layer.id}
      name={layer.id}
      x={resolved.x}
      y={resolved.y}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      scaleX={resolved.scaleX}
      scaleY={resolved.scaleY}
      rotation={resolved.rotation}
      opacity={resolved.opacity}
      draggable={draggable}
      listening={interactive}
      clip={clip}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
      onDragStart={() => onDragStart(layer.id)}
      onDragMove={(e) => onDragMove(layer.id, e.target)}
      onDragEnd={onDragEnd}
    >
      <LayerContent layer={layer} width={width} height={height} blur={resolved.blur} />
    </Group>
  );
}

export const CanvasLayerNode = React.memo(CanvasLayerNodeImpl, (prev, next) => {
  // Identity check on the layer catches every property edit, and the resolved
  // fields cover animation motion. Comparing explicitly beats a deep equal here
  // because this runs for every visible layer on every frame.
  if (prev.layer !== next.layer) return false;
  if (prev.interactive !== next.interactive) return false;
  const a = prev.resolved;
  const b = next.resolved;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY &&
    a.rotation === b.rotation &&
    a.opacity === b.opacity &&
    a.blur === b.blur &&
    a.clipProgress === b.clipProgress
  );
});

// ---------------------------------------------------------------------------

function LayerContent({
  layer,
  width,
  height,
  blur,
}: {
  layer: Layer;
  width: number;
  height: number;
  blur: number;
}) {
  switch (layer.type) {
    case "text":
      return <TextContent layer={layer} width={width} height={height} />;
    case "image":
      return <ImageContent layer={layer} width={width} height={height} blur={blur} />;
    case "video":
      return <VideoContent layer={layer} width={width} height={height} />;
    case "shape":
      return <ShapeContent layer={layer} width={width} height={height} />;
    case "icon":
      return <IconContent layer={layer} width={width} height={height} />;
    case "gradient":
      return <GradientContent layer={layer} width={width} height={height} />;
    default:
      return null;
  }
}

function TextContent({
  layer,
  width,
  height,
}: {
  layer: Extract<Layer, { type: "text" }>;
  width: number;
  height: number;
}) {
  const p = layer.properties;
  const editingId = useEditorStore((s) => s.editingTextLayerId);
  const text = applyTransform(p.text, p.textTransform);

  return (
    <>
      {p.backgroundColor && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={p.backgroundColor}
          // Konva has no `999px` idiom; clamp to a true pill.
          cornerRadius={Math.min(p.backgroundRadius, Math.min(width, height) / 2)}
          perfectDrawEnabled={false}
        />
      )}
      {/* Hidden while the inline editor is open so the two don't double up. */}
      {editingId !== layer.id && (
        <Text
          x={p.paddingX}
          y={p.paddingY}
          width={Math.max(1, width - p.paddingX * 2)}
          height={Math.max(1, height - p.paddingY * 2)}
          text={text}
          fontFamily={p.fontFamily}
          fontSize={p.fontSize}
          fontStyle={`${p.fontStyle === "italic" ? "italic " : ""}${p.fontWeight}`}
          fill={p.color}
          align={p.align}
          verticalAlign="middle"
          lineHeight={p.lineHeight}
          letterSpacing={p.letterSpacing}
          wrap="word"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </>
  );
}

function applyTransform(text: string, transform: string): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

/** Loads an image once per src and keeps it across re-renders. */
function useImageElement(src: string) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!src) return;
    setFailed(false);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return { image, failed };
}

function ImageContent({
  layer,
  width,
  height,
  blur,
}: {
  layer: Extract<Layer, { type: "image" }>;
  width: number;
  height: number;
  blur: number;
}) {
  const p = layer.properties;
  const { image, failed } = useImageElement(p.src);
  const nodeRef = React.useRef<Konva.Image>(null);

  const needsFilters =
    p.brightness !== 100 || p.contrast !== 100 || p.saturation !== 100 || p.blur > 0 || blur > 0;

  // Konva filters need an explicit cache; recache only when an input changes,
  // because caching rasterises the node and is expensive.
  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node || !image) return;
    if (needsFilters) {
      node.cache();
    } else {
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
  }, [image, needsFilters, p.brightness, p.contrast, p.saturation, p.blur, blur, width, height]);

  if (failed) return <MissingMedia width={width} height={height} label="Image unavailable" />;
  if (!image) return <Rect width={width} height={height} fill="#1a1725" cornerRadius={p.cornerRadius} />;

  const crop = computeCrop(image, width, height, p.fit);
  // Konva's filter functions are reached through the runtime namespace; v10
  // no longer exports a `Filter` type, so describe the shape we rely on.
  type KonvaFilterFn = (imageData: ImageData) => void;
  const KonvaFilters = (globalThis as unknown as { Konva?: { Filters?: Record<string, KonvaFilterFn> } })
    .Konva?.Filters;

  return (
    <KonvaImage
      ref={nodeRef}
      image={image}
      width={width}
      height={height}
      cornerRadius={p.cornerRadius}
      crop={crop}
      listening={false}
      perfectDrawEnabled={false}
      {...(needsFilters && KonvaFilters
        ? {
            filters: [
              KonvaFilters.Brighten,
              KonvaFilters.Contrast,
              KonvaFilters.HSL,
              KonvaFilters.Blur,
            ].filter((f): f is KonvaFilterFn => typeof f === "function"),
            // Konva's Brighten takes -1..1, our model is a 0-300% scale.
            brightness: (p.brightness - 100) / 100,
            contrast: p.contrast - 100,
            saturation: (p.saturation - 100) / 100,
            blurRadius: p.blur + blur,
          }
        : {})}
    />
  );
}

/** Object-fit `cover`/`contain` expressed as a Konva crop rect. */
function computeCrop(
  image: HTMLImageElement,
  width: number,
  height: number,
  fit: "cover" | "contain" | "fill",
): { x: number; y: number; width: number; height: number } | undefined {
  if (fit === "fill") return undefined;

  const boxRatio = width / height;
  const imageRatio = image.width / image.height;

  if (fit === "contain") return undefined;

  // Cover: crop the overflowing axis, centred.
  if (imageRatio > boxRatio) {
    const cropWidth = image.height * boxRatio;
    return { x: (image.width - cropWidth) / 2, y: 0, width: cropWidth, height: image.height };
  }
  const cropHeight = image.width / boxRatio;
  return { x: 0, y: (image.height - cropHeight) / 2, width: image.width, height: cropHeight };
}

/**
 * Video on the editing canvas.
 *
 * A hidden `<video>` element is seeked to the layer's local time and drawn as a
 * Konva image. During playback an animation frame loop keeps redrawing; when
 * paused a single seek is enough, which avoids burning a rAF per video layer
 * while the user is just arranging things.
 */
function VideoContent({
  layer,
  width,
  height,
}: {
  layer: Extract<Layer, { type: "video" }>;
  width: number;
  height: number;
}) {
  const p = layer.properties;
  const imageRef = React.useRef<Konva.Image>(null);
  const [element, setElement] = React.useState<HTMLVideoElement | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const video = window.document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = p.src;
    const onReady = () => setElement(video);
    const onError = () => setFailed(true);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
      video.pause();
      video.src = "";
    };
  }, [p.src]);

  React.useEffect(() => {
    if (!element) return;
    let raf = 0;

    const sync = () => {
      const state = useEditorStore.getState();
      const local = state.currentTime - layer.startTime;
      const target = p.trimStart + Math.max(0, local) * p.playbackRate;

      if (state.isPlaying) {
        if (element.paused) void element.play().catch(() => {});
        if (Math.abs(element.currentTime - target) > 0.3) element.currentTime = target;
      } else {
        if (!element.paused) element.pause();
        if (Math.abs(element.currentTime - target) > 0.05) element.currentTime = target;
      }

      imageRef.current?.getLayer()?.batchDraw();
      raf = requestAnimationFrame(sync);
    };

    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [element, layer.startTime, p.trimStart, p.playbackRate]);

  if (failed) return <MissingMedia width={width} height={height} label="Video unavailable" />;
  if (!element) return <Rect width={width} height={height} fill="#161320" cornerRadius={p.cornerRadius} />;

  return (
    <KonvaImage
      ref={imageRef}
      image={element}
      width={width}
      height={height}
      cornerRadius={p.cornerRadius}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

function ShapeContent({
  layer,
  width,
  height,
}: {
  layer: Extract<Layer, { type: "shape" }>;
  width: number;
  height: number;
}) {
  const p = layer.properties;
  const stroke = p.stroke && p.strokeWidth > 0 ? p.stroke : undefined;
  const common = {
    fill: p.fill,
    stroke,
    strokeWidth: stroke ? p.strokeWidth : 0,
    listening: false,
    perfectDrawEnabled: false,
  } as const;

  switch (p.kind) {
    case "circle":
      // Ellipse, not Circle: a shape layer's box is rarely square, and
      // Konva's Circle takes a single radius (radiusX/radiusY are Ellipse-only
      // props that Circle silently ignores).
      return (
        <Ellipse
          {...common}
          x={width / 2}
          y={height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
        />
      );

    case "triangle":
      return (
        <RegularPolygon
          {...common}
          x={width / 2}
          y={height / 2}
          sides={3}
          radius={Math.min(width, height) / 2}
          scaleX={width / Math.min(width, height)}
          scaleY={height / Math.min(width, height)}
        />
      );

    case "star":
      return (
        <Star
          {...common}
          x={width / 2}
          y={height / 2}
          numPoints={5}
          innerRadius={Math.min(width, height) / 4.4}
          outerRadius={Math.min(width, height) / 2}
          scaleX={width / Math.min(width, height)}
          scaleY={height / Math.min(width, height)}
        />
      );

    case "arrow":
      // Drawn as a normalised path so it stretches with the box.
      return (
        <Path
          {...common}
          data="M0,14 L70,14 L70,2 L100,20 L70,38 L70,26 L0,26 Z"
          scaleX={width / 100}
          scaleY={height / 40}
        />
      );

    case "line":
      return <Line {...common} points={[0, height / 2, width, height / 2]} strokeWidth={height} stroke={p.fill} />;

    case "roundedRect":
      return <Rect {...common} width={width} height={height} cornerRadius={p.cornerRadius} />;

    case "rectangle":
    default:
      return <Rect {...common} width={width} height={height} />;
  }
}

function IconContent({
  layer,
  width,
  height,
}: {
  layer: Extract<Layer, { type: "icon" }>;
  width: number;
  height: number;
}) {
  const p = layer.properties;
  const paths = getIconPath(p.name);
  // Lucide icons are authored on a 24×24 grid.
  const scale = Math.min(width, height) / 24;

  return (
    <Group x={(width - 24 * scale) / 2} y={(height - 24 * scale) / 2} scaleX={scale} scaleY={scale} listening={false}>
      {paths.map((d: string, index: number) => (
        <Path
          key={index}
          data={d}
          stroke={p.color}
          strokeWidth={p.strokeWidth}
          lineCap="round"
          lineJoin="round"
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  );
}

function GradientContent({
  layer,
  width,
  height,
}: {
  layer: Extract<Layer, { type: "gradient" }>;
  width: number;
  height: number;
}) {
  const p = layer.properties;

  if (p.kind === "linear") {
    const radians = ((p.angle - 90) * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);
    return (
      <Rect
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: width / 2 - (dx * width) / 2, y: height / 2 - (dy * height) / 2 }}
        fillLinearGradientEndPoint={{ x: width / 2 + (dx * width) / 2, y: height / 2 + (dy * height) / 2 }}
        fillLinearGradientColorStops={[0, p.from, 1, p.to]}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  // Blob/radial: a soft bloom that fades to transparent, matching the DOM
  // renderer's `radial-gradient(... , transparent 72%)`.
  const stops =
    p.kind === "blob"
      ? [0, p.from, 0.45, withAlpha(p.to, 0.35), 1, withAlpha(p.to, 0)]
      : [0, p.from, 1, p.to];

  return (
    <Ellipse
      x={width / 2}
      y={height / 2}
      radiusX={width / 2}
      radiusY={height / 2}
      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
      fillRadialGradientEndRadius={Math.max(width, height) / 2}
      fillRadialGradientColorStops={stops}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shown in place of media that failed to load, so a broken URL is obvious. */
function MissingMedia({ width, height, label }: { width: number; height: number; label: string }) {
  return (
    <>
      <Rect width={width} height={height} fill="#2a1520" stroke="#ef4444" strokeWidth={2} dash={[8, 6]} listening={false} />
      <Text
        width={width}
        height={height}
        text={label}
        align="center"
        verticalAlign="middle"
        fill="#fca5a5"
        fontSize={Math.max(12, Math.min(width, height) * 0.09)}
        fontFamily="Inter"
        listening={false}
      />
    </>
  );
}
