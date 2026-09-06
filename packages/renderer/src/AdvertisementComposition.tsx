import * as React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  continueRender,
  delayRender,
} from "remotion";
import {
  parseProjectDocument,
  resolveAudioVolumeAtTime,
  type ProjectDocument,
} from "@workspace/motion";
import { AdvertisementStage } from "./AdvertisementStage";

/**
 * The Remotion composition.
 *
 * It converts Remotion's frame counter into the seconds the shared stage
 * expects, then hands off. Audio is Remotion's job (it mixes the tracks into
 * the encoder); everything visual comes from `AdvertisementStage`, the same
 * component the editor previews with.
 */

export type AdvertisementCompositionProps = {
  /** Passed as `inputProps`, so it arrives as plain JSON and must be re-parsed. */
  document: ProjectDocument;
  // Remotion requires composition props to be indexable.
  [key: string]: unknown;
};

export const AdvertisementComposition: React.FC<AdvertisementCompositionProps> = ({ document: raw }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // inputProps cross a process boundary as JSON. Re-validating here means a
  // malformed document fails the render loudly instead of painting a black
  // video that nobody notices until download.
  const doc = React.useMemo(() => parseProjectDocument(raw), [raw]);
  const time = frame / fps;

  useFontsReady();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AdvertisementStage
        document={doc}
        time={time}
        renderVideo={({ src, style, volume, muted, playbackRate, trimStart }) => (
          <OffthreadVideo
            src={src}
            style={style}
            volume={muted ? 0 : volume}
            playbackRate={playbackRate}
            startFrom={Math.round(trimStart * fps)}
          />
        )}
      />

      {doc.audioTracks.map((track) => {
        const from = Math.round(track.startTime * fps);
        const durationInFrames = Math.max(1, Math.round(track.duration * fps));
        return (
          <Sequence key={track.id} from={from} durationInFrames={durationInFrames}>
            <Audio
              src={track.src}
              // Remotion gives the volume callback a frame local to the
              // sequence; shift it back onto the project timeline so fades line
              // up with what the editor's scrubber showed.
              volume={(f) => resolveAudioVolumeAtTime(track, track.startTime + f / fps)}
              startFrom={Math.round(track.trimStart * fps)}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Holds the render until webfonts have loaded.
 *
 * Without this, headless Chrome will happily rasterise the first frames in a
 * fallback face and the exported video shows a font pop a few frames in.
 */
function useFontsReady() {
  const [handle] = React.useState(() => delayRender("Waiting for fonts"));
  const done = React.useRef(false);

  React.useEffect(() => {
    if (done.current) return;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      continueRender(handle);
    };

    const fonts = (globalThis as { document?: Document }).document?.fonts;
    if (!fonts) {
      finish();
      return;
    }
    fonts.ready.then(finish).catch(finish);
    // Never let a stalled font request hang the whole render.
    const timer = setTimeout(finish, 8000);
    return () => clearTimeout(timer);
  }, [handle]);
}
