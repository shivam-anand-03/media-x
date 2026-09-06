import * as React from "react";
import { Composition } from "remotion";
import { SAMPLE_PROJECT, totalFrames, type ProjectDocument } from "@workspace/motion";
import { AdvertisementComposition } from "./AdvertisementComposition.js";

export const ADVERTISEMENT_COMPOSITION_ID = "Advertisement";

/**
 * Remotion's composition registry.
 *
 * Dimensions, fps and length are all overridden per render from the project
 * document (`calculateMetadata`), so this single composition serves every
 * canvas preset instead of needing one entry per format.
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id={ADVERTISEMENT_COMPOSITION_ID}
    component={AdvertisementComposition}
    // Defaults only — real values come from calculateMetadata below.
    width={SAMPLE_PROJECT.canvas.width}
    height={SAMPLE_PROJECT.canvas.height}
    fps={SAMPLE_PROJECT.canvas.fps}
    durationInFrames={totalFrames(SAMPLE_PROJECT)}
    defaultProps={{ document: SAMPLE_PROJECT }}
    calculateMetadata={({ props }) => {
      const doc = props.document;
      return {
        width: doc.canvas.width,
        height: doc.canvas.height,
        fps: doc.canvas.fps,
        durationInFrames: Math.max(1, Math.round(doc.canvas.duration * doc.canvas.fps)),
      };
    }}
  />
);
