"use client";

import * as React from "react";
import { Stage, Layer as KonvaLayer, Rect, Transformer, Line, Group } from "react-konva";
import type Konva from "konva";
import {
  resolveLayerAtTime,
  type Layer,
  type ProjectDocument,
} from "@workspace/motion";
import { useEditorStore } from "../../stores/editor-store";
import { buildSnapTargets, snapBounds, type SnapTargets } from "../../lib/snapping";
import { useCanvasThemeColors } from "../../hooks/use-theme-colors";
import { CanvasLayerNode } from "./canvas-layer-node";

/**
 * The interactive editing surface.
 *
 * Konva owns hit-testing, dragging and the transform handles; the *values* it
 * produces are written straight back into the editor store, and every layer's
 * appearance at the current time comes from `resolveLayerAtTime` — the same
 * function the preview and the Remotion renderer use. The canvas therefore
 * never has an opinion about animation of its own.
 *
 * While a layer is being dragged or transformed, updates are marked transient
 * so the whole gesture collapses into a single undo step (see
 * `beginInteraction` in the store).
 */

export interface CanvasStageProps {
  document: ProjectDocument;
  /** Screen pixels per canvas pixel. */
  scale: number;
  onSelectBackground?: () => void;
}

export function CanvasStage({ document: doc, scale, onSelectBackground }: CanvasStageProps) {
  const stageRef = React.useRef<Konva.Stage>(null);
  const transformerRef = React.useRef<Konva.Transformer>(null);
  const nodeRegistry = React.useRef<Map<string, Konva.Node>>(new Map());
  const snapTargets = React.useRef<SnapTargets | null>(null);

  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedIds = useEditorStore((s) => s.selectedLayerIds);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const showSafeArea = useEditorStore((s) => s.showSafeArea);
  const guides = useEditorStore((s) => s.guides);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  // Konva cannot read CSS variables, so the chrome colours are resolved from
  // the theme at runtime instead of hardcoded.
  const theme = useCanvasThemeColors();

  const { canvas } = doc;

  // Only layers on screen right now are rendered — a 200-layer project with 8
  // visible costs 8 nodes, not 200.
  const visible = React.useMemo(
    () =>
      doc.layers
        .map((layer) => ({ layer, resolved: resolveLayerAtTime(layer, currentTime) }))
        .filter((entry) => entry.resolved.visible)
        .sort((a, b) => a.layer.zIndex - b.layer.zIndex),
    [doc.layers, currentTime],
  );

  const registerNode = React.useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRegistry.current.set(id, node);
    else nodeRegistry.current.delete(id);
  }, []);

  // Keep the transformer attached to whatever is selected *and* currently on
  // screen. A selected layer scrubbed out of its time range has no node, so it
  // must drop out of the transformer or Konva throws.
  React.useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (isPlaying || selectedIds.length === 0) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedIds
      .map((id) => nodeRegistry.current.get(id))
      .filter((node): node is Konva.Node => Boolean(node));

    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, visible, isPlaying]);

  // ---- Selection ----------------------------------------------------------

  const handleStageMouseDown = React.useCallback(
    (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      // A click that lands on the stage itself (not a layer) clears selection.
      if (event.target === event.target.getStage()) {
        useEditorStore.getState().clearSelection();
        onSelectBackground?.();
      }
    },
    [onSelectBackground],
  );

  // ---- Drag ---------------------------------------------------------------

  const handleDragStart = React.useCallback(
    (layerId: string) => {
      const store = useEditorStore.getState();
      // Dragging an unselected layer selects it first, like every design tool.
      if (!store.selectedLayerIds.includes(layerId)) {
        store.selectLayer(layerId);
      }
      store.beginInteraction(layerId);
      snapTargets.current = buildSnapTargets(
        store.document?.layers ?? [],
        store.selectedLayerIds.includes(layerId) ? store.selectedLayerIds : [layerId],
        canvas.width,
        canvas.height,
      );
    },
    [canvas.width, canvas.height],
  );

  const handleDragMove = React.useCallback(
    (layerId: string, node: Konva.Node) => {
      const store = useEditorStore.getState();
      const layer = store.document?.layers.find((l) => l.id === layerId);
      if (!layer) return;

      let x = node.x();
      let y = node.y();

      if (snapEnabled && snapTargets.current) {
        const result = snapBounds(
          {
            x,
            y,
            width: layer.transform.width * Math.abs(layer.transform.scaleX),
            height: layer.transform.height * Math.abs(layer.transform.scaleY),
          },
          snapTargets.current,
          scale,
        );
        x = result.x;
        y = result.y;
        // Writing the snapped position back to the node is what makes the
        // layer visibly lock onto the guide instead of lagging the cursor.
        node.x(x);
        node.y(y);
        store.setGuides(result.guides);
      }

      store.patchLayerTransform(layerId, { x, y }, { transient: true });
    },
    [snapEnabled, scale],
  );

  const handleDragEnd = React.useCallback(() => {
    snapTargets.current = null;
    useEditorStore.getState().endInteraction();
  }, []);

  // ---- Transform ----------------------------------------------------------

  const handleTransformStart = React.useCallback(() => {
    useEditorStore.getState().beginInteraction(useEditorStore.getState().selectedLayerIds[0] ?? null);
  }, []);

  /**
   * Konva expresses a resize as a scale on the node. Baking it back into
   * width/height (and resetting the node's scale to 1) keeps the document in
   * absolute pixels, which is what the renderer and the inspector expect —
   * otherwise a resized layer would carry a permanent scale factor that
   * compounds with animation scale.
   */
  const handleTransformEnd = React.useCallback(() => {
    const store = useEditorStore.getState();

    for (const id of store.selectedLayerIds) {
      const node = nodeRegistry.current.get(id);
      const layer = store.document?.layers.find((l) => l.id === id);
      if (!node || !layer) continue;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      store.patchLayerTransform(
        id,
        {
          x: node.x(),
          y: node.y(),
          width: Math.max(1, layer.transform.width * Math.abs(scaleX)),
          height: Math.max(1, layer.transform.height * Math.abs(scaleY)),
          rotation: node.rotation(),
          // Preserve a flip as a negative scale; magnitude moves into w/h.
          scaleX: scaleX < 0 ? -1 : 1,
          scaleY: scaleY < 0 ? -1 : 1,
        },
        { transient: true },
      );

      node.scaleX(scaleX < 0 ? -1 : 1);
      node.scaleY(scaleY < 0 ? -1 : 1);
    }

    store.endInteraction();
  }, []);

  const stageWidth = canvas.width * scale;
  const stageHeight = canvas.height * scale;

  return (
    <Stage
      ref={stageRef}
      width={stageWidth}
      height={stageHeight}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={handleStageMouseDown}
      onTouchStart={handleStageMouseDown}
      style={{ display: "block" }}
    >
      {/* Background — its own layer so layer edits never repaint it. */}
      <KonvaLayer listening={false}>
        <CanvasBackground document={doc} />
      </KonvaLayer>

      {/* Content */}
      <KonvaLayer>
        {visible.map(({ layer, resolved }) => (
          <CanvasLayerNode
            key={layer.id}
            layer={layer}
            resolved={resolved}
            registerNode={registerNode}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            interactive={!isPlaying}
          />
        ))}
      </KonvaLayer>

      {/* Overlay — guides, safe area and handles sit above the artwork. */}
      <KonvaLayer>
        {showSafeArea && (
          <SafeAreaOverlay width={canvas.width} height={canvas.height} color={theme.safeArea} />
        )}

        {guides.map((guide, index) => (
          <Line
            key={`${guide.axis}-${guide.position}-${index}`}
            points={
              guide.axis === "x"
                ? [guide.position, 0, guide.position, canvas.height]
                : [0, guide.position, canvas.width, guide.position]
            }
            stroke={guide.kind === "center" ? theme.guideCenter : theme.guideEdge}
            // Divide by scale so the guide is always a hairline on screen.
            strokeWidth={1 / scale}
            dash={guide.kind === "center" ? undefined : [6 / scale, 4 / scale]}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}

        <Transformer
          ref={transformerRef}
          rotateEnabled
          keepRatio={false}
          ignoreStroke
          padding={2 / scale}
          anchorSize={9 / scale}
          anchorCornerRadius={2 / scale}
          anchorStroke={theme.accent}
          anchorFill={theme.handleFill}
          anchorStrokeWidth={1.5 / scale}
          borderStroke={theme.accent}
          borderStrokeWidth={1.5 / scale}
          rotateAnchorOffset={26 / scale}
          onTransformStart={handleTransformStart}
          onTransformEnd={handleTransformEnd}
          boundBoxFunc={(oldBox, newBox) =>
            // Refuse degenerate boxes; Konva will otherwise happily invert them.
            newBox.width < 6 || newBox.height < 6 ? oldBox : newBox
          }
        />
      </KonvaLayer>
    </Stage>
  );
}

/** Paints the project background inside the canvas rect. */
function CanvasBackground({ document: doc }: { document: ProjectDocument }) {
  const { canvas, background } = doc;

  if (background.type === "gradient") {
    // Konva takes gradient endpoints, so convert the CSS angle into a vector
    // across the canvas box.
    const radians = ((background.angle - 90) * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);
    const halfW = canvas.width / 2;
    const halfH = canvas.height / 2;
    return (
      <Rect
        x={0}
        y={0}
        width={canvas.width}
        height={canvas.height}
        fillLinearGradientStartPoint={{ x: halfW - dx * halfW, y: halfH - dy * halfH }}
        fillLinearGradientEndPoint={{ x: halfW + dx * halfW, y: halfH + dy * halfH }}
        fillLinearGradientColorStops={[0, background.from, 1, background.to]}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  if (background.type === "image") {
    return <BackgroundImage src={background.src} width={canvas.width} height={canvas.height} />;
  }

  return (
    <Rect
      x={0}
      y={0}
      width={canvas.width}
      height={canvas.height}
      fill={background.value}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

function BackgroundImage({ src, width, height }: { src: string; width: number; height: number }) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!image) {
    return <Rect x={0} y={0} width={width} height={height} fill="#0b0713" listening={false} />;
  }

  // Cover: scale to fill, centred.
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;

  return (
    <Rect
      x={(width - w) / 2}
      y={(height - h) / 2}
      width={w}
      height={h}
      fillPatternImage={image}
      fillPatternScaleX={scale}
      fillPatternScaleY={scale}
      listening={false}
    />
  );
}

/** Title/action safe margins, so key content isn't clipped by platform chrome. */
function SafeAreaOverlay({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const insetX = width * 0.06;
  const insetY = height * 0.08;
  return (
    <Group listening={false}>
      <Rect
        x={insetX}
        y={insetY}
        width={width - insetX * 2}
        height={height - insetY * 2}
        stroke={color}
        strokeWidth={Math.max(1, width / 900)}
        dash={[12, 10]}
        opacity={0.45}
        listening={false}
      />
    </Group>
  );
}
