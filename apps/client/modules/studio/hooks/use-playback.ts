"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "../stores/editor-store";

/**
 * The playback clock.
 *
 * Drives `currentTime` from `requestAnimationFrame` using real elapsed time
 * rather than a fixed per-frame increment, so playback stays in sync with the
 * wall clock even when a heavy frame drops. Mounted once by the editor shell;
 * every other component just reads `currentTime`.
 */
export function usePlaybackClock() {
  const rafId = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const state = useEditorStore.getState();

      if (!state.isPlaying || !state.document) {
        lastTs.current = null;
        rafId.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTs.current === null) {
        lastTs.current = timestamp;
        rafId.current = requestAnimationFrame(tick);
        return;
      }

      const deltaSeconds = (timestamp - lastTs.current) / 1000;
      lastTs.current = timestamp;

      const duration = state.document.canvas.duration;
      const next = state.currentTime + deltaSeconds;

      if (next >= duration) {
        if (state.loopPlayback) {
          // Carry the overshoot so looping doesn't drift slower than realtime.
          state.setCurrentTime(next % duration);
        } else {
          state.setCurrentTime(duration);
          state.pause();
        }
      } else {
        state.setCurrentTime(next);
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      lastTs.current = null;
    };
  }, []);
}

/**
 * Plays the project's audio tracks in step with the playhead.
 *
 * Kept separate from the visual clock because audio elements are stateful and
 * expensive: they are created once per track and then only seeked when the
 * playhead has drifted beyond `SYNC_TOLERANCE`, which avoids the stutter that
 * comes from assigning `currentTime` every frame.
 */
const SYNC_TOLERANCE = 0.25;

export function useAudioPlayback(enabled = true) {
  const elements = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    const pool = elements.current;

    const unsubscribe = useEditorStore.subscribe(
      (s) => ({
        tracks: s.document?.audioTracks,
        time: s.currentTime,
        playing: s.isPlaying,
      }),
      ({ tracks, time, playing }) => {
        if (!tracks) return;

        // Drop elements for tracks that no longer exist.
        for (const [id, el] of pool) {
          if (!tracks.some((t) => t.id === id)) {
            el.pause();
            el.src = "";
            pool.delete(id);
          }
        }

        for (const track of tracks) {
          let el = pool.get(track.id);
          if (!el) {
            // No `crossOrigin` here on purpose. Plain playback never needs CORS
            // (only canvas pixel access does), and requiring it turns any
            // missing Access-Control-Allow-Origin header into silent silence.
            // Setting `src` last also matters: assigning it in the constructor
            // starts the fetch before later properties can affect it.
            el = new Audio();
            el.preload = "auto";
            const id = track.id;
            el.addEventListener("error", () => {
              // A deleted or unreachable file would otherwise just be silence.
              useEditorStore.getState().markAudioUnavailable(id, true);
            });
            el.addEventListener("canplay", () => {
              useEditorStore.getState().markAudioUnavailable(id, false);
            });
            el.src = track.src;
            pool.set(track.id, el);
          }

          const local = time - track.startTime;
          const active = playing && local >= 0 && local < track.duration && !track.muted;

          if (!active) {
            if (!el.paused) el.pause();
            continue;
          }

          const target = track.trimStart + local;
          if (Math.abs(el.currentTime - target) > SYNC_TOLERANCE) {
            el.currentTime = target;
          }

          // Fades are computed by the same engine the export uses, so what the
          // user hears while scrubbing matches the encoded audio.
          el.volume = computeGain(track, time);
          if (el.paused) {
            void el.play().catch((error: unknown) => {
              // Autoplay policy or an unreachable file. Log it rather than
              // failing silently — "no sound and no explanation" is the worst
              // possible outcome here.
              console.warn(`[audio] could not play "${track.name}":`, error);
            });
          }
        }
      },
      { equalityFn: (a, b) => a.time === b.time && a.playing === b.playing && a.tracks === b.tracks },
    );

    return () => {
      unsubscribe();
      for (const el of pool.values()) {
        el.pause();
        el.src = "";
      }
      pool.clear();
    };
  }, [enabled]);
}

function computeGain(
  track: { startTime: number; duration: number; volume: number; fadeIn: number; fadeOut: number; muted: boolean },
  time: number,
): number {
  if (track.muted) return 0;
  const local = time - track.startTime;
  if (local < 0 || local >= track.duration) return 0;

  let gain = track.volume;
  if (track.fadeIn > 0 && local < track.fadeIn) gain *= local / track.fadeIn;
  const remaining = track.duration - local;
  if (track.fadeOut > 0 && remaining < track.fadeOut) gain *= remaining / track.fadeOut;
  return Math.max(0, Math.min(1, gain));
}
