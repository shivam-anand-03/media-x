import * as React from "react";
import { isKnownIcon, type Layer, type ResolvedLayer } from "@workspace/motion";
import { gradientBackground, imageFilter, layerFrameStyle, textStyle } from "./layer-style";
import { IconGlyph } from "./IconGlyph";

/**
 * Paints one layer.
 *
 * Shared verbatim between the editor's preview player and the Remotion
 * composition. It takes an already-resolved layer, so it contains no timing or
 * animation logic of its own — that all lives in `@workspace/motion`.
 */

export interface LayerRendererProps {
  layer: Layer;
  resolved: ResolvedLayer;
  /**
   * How a video layer gets its frames. Remotion supplies its own `<OffthreadVideo>`
   * (frame-accurate, deterministic); the browser preview supplies a plain
   * `<video>` it seeks. Injecting it keeps this component free of both.
   */
  renderVideo?: (props: {
    src: string;
    style: React.CSSProperties;
    localTime: number;
    volume: number;
    muted: boolean;
    playbackRate: number;
    trimStart: number;
  }) => React.ReactNode;
}

const objectFitStyle = (fit: "cover" | "contain" | "fill"): React.CSSProperties => ({
  width: "100%",
  height: "100%",
  objectFit: fit,
  display: "block",
});

export const LayerRenderer = React.memo(function LayerRenderer({
  layer,
  resolved,
  renderVideo,
}: LayerRendererProps) {
  const frame = layerFrameStyle(resolved, layer);

  switch (layer.type) {
    case "text":
      return (
        <div style={frame}>
          <div style={textStyle(layer)}>{layer.properties.text}</div>
        </div>
      );

    case "image":
      return (
        <div style={{ ...frame, overflow: "hidden", borderRadius: layer.properties.cornerRadius }}>
          <img
            src={layer.properties.src}
            alt=""
            draggable={false}
            style={{ ...objectFitStyle(layer.properties.fit), filter: imageFilter(layer.properties) }}
          />
        </div>
      );

    case "video": {
      const p = layer.properties;
      const inner: React.CSSProperties = objectFitStyle(p.fit);
      return (
        <div style={{ ...frame, overflow: "hidden", borderRadius: p.cornerRadius }}>
          {renderVideo ? (
            renderVideo({
              src: p.src,
              style: inner,
              localTime: resolved.localTime,
              volume: p.volume,
              muted: p.muted,
              playbackRate: p.playbackRate,
              trimStart: p.trimStart,
            })
          ) : (
            <video src={p.src} style={inner} muted playsInline />
          )}
        </div>
      );
    }

    case "shape":
      return <div style={frame}>{renderShape(layer)}</div>;

    case "icon": {
      const p = layer.properties;
      return (
        <div style={{ ...frame, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconGlyph
            name={isKnownIcon(p.name) ? p.name : "sparkles"}
            color={p.color}
            strokeWidth={p.strokeWidth}
          />
        </div>
      );
    }

    case "gradient": {
      const p = layer.properties;
      return (
        <div
          style={{
            ...frame,
            background: gradientBackground(p),
            borderRadius: p.kind === "linear" ? 0 : "50%",
            filter: p.blur > 0 ? `blur(${p.blur}px)` : frame.filter,
          }}
        />
      );
    }

    default:
      return null;
  }
});

/** Shapes are SVG so strokes, arrows and stars scale cleanly at any size. */
function renderShape(layer: Extract<Layer, { type: "shape" }>): React.ReactNode {
  const p = layer.properties;
  const common = { width: "100%", height: "100%", display: "block" } as const;
  const stroke = p.stroke && p.strokeWidth > 0 ? p.stroke : undefined;

  switch (p.kind) {
    case "rectangle":
    case "line":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: p.fill,
            border: stroke ? `${p.strokeWidth}px solid ${stroke}` : undefined,
            boxSizing: "border-box",
          }}
        />
      );

    case "roundedRect":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: p.fill,
            borderRadius: p.cornerRadius,
            border: stroke ? `${p.strokeWidth}px solid ${stroke}` : undefined,
            boxSizing: "border-box",
          }}
        />
      );

    case "circle":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: p.fill,
            borderRadius: "50%",
            border: stroke ? `${p.strokeWidth}px solid ${stroke}` : undefined,
            boxSizing: "border-box",
          }}
        />
      );

    case "triangle":
      return (
        <svg {...common} viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,2 98,98 2,98" fill={p.fill} stroke={stroke} strokeWidth={stroke ? p.strokeWidth : 0} />
        </svg>
      );

    case "star":
      return (
        <svg {...common} viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38"
            fill={p.fill}
            stroke={stroke}
            strokeWidth={stroke ? p.strokeWidth : 0}
          />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common} viewBox="0 0 100 40" preserveAspectRatio="none">
          <polygon points="0,14 70,14 70,2 100,20 70,38 70,26 0,26" fill={p.fill} />
        </svg>
      );

    default:
      return null;
  }
}
