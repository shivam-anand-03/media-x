import * as React from "react";
import {
  resolveTransition,
  sceneAtTime,
  type ProjectDocument,
} from "@workspace/motion";
import { backgroundStyle, visibleLayersAtTime } from "./layer-style";
import { LayerRenderer, type LayerRendererProps } from "./LayerRenderer";

/**
 * A single frame of an advertisement, at native canvas resolution.
 *
 * Renderer-agnostic: it takes a document and a time and paints the frame. The
 * Remotion composition wraps it with `useCurrentFrame`, and the editor's
 * preview player wraps it with a `requestAnimationFrame` clock. Both therefore
 * produce identical pixels — the export can't drift from the preview because
 * there is only one implementation.
 */

export interface AdvertisementStageProps {
  document: ProjectDocument;
  /** Seconds from the start of the advertisement. */
  time: number;
  renderVideo?: LayerRendererProps["renderVideo"];
  /** Ids to skip — the editor hides a layer it is actively dragging. */
  hiddenLayerIds?: readonly string[];
  className?: string;
  style?: React.CSSProperties;
}

export function AdvertisementStage({
  document: doc,
  time,
  renderVideo,
  hiddenLayerIds,
  className,
  style,
}: AdvertisementStageProps) {
  const { canvas } = doc;

  const entries = React.useMemo(() => {
    const visible = visibleLayersAtTime(doc.layers, time);
    if (!hiddenLayerIds?.length) return visible;
    const skip = new Set(hiddenLayerIds);
    return visible.filter((e) => !skip.has(e.layer.id));
  }, [doc.layers, time, hiddenLayerIds]);

  // Scene transitions animate the whole scene group, so layers inside a scene
  // inherit the transition without every layer needing its own animation.
  const scene = sceneAtTime(doc.scenes, time);
  const sceneTransform = React.useMemo(() => {
    if (!scene || scene.transition.type === "none" || scene.transition.duration <= 0) return null;
    const elapsed = time - scene.startTime;
    if (elapsed >= scene.transition.duration) return null;
    return resolveTransition(
      scene.transition,
      elapsed / scene.transition.duration,
      canvas.width,
      canvas.height,
    );
  }, [scene, time, canvas.width, canvas.height]);

  const sceneStyle: React.CSSProperties = sceneTransform
    ? {
        opacity: sceneTransform.opacity,
        transform: `translate(${sceneTransform.translateX}px, ${sceneTransform.translateY}px) scale(${sceneTransform.scale})`,
        transformOrigin: "center center",
        filter: sceneTransform.blur > 0 ? `blur(${sceneTransform.blur}px)` : undefined,
        clipPath:
          sceneTransform.clipProgress < 1
            ? `inset(0 ${(1 - sceneTransform.clipProgress) * 100}% 0 0)`
            : undefined,
      }
    : {};

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: canvas.width,
        height: canvas.height,
        overflow: "hidden",
        ...backgroundStyle(doc.background),
        ...style,
      }}
    >
      <div style={{ position: "absolute", inset: 0, ...sceneStyle }}>
        {entries.map(({ layer, resolved }) => (
          <LayerRenderer key={layer.id} layer={layer} resolved={resolved} renderVideo={renderVideo} />
        ))}
      </div>
    </div>
  );
}
