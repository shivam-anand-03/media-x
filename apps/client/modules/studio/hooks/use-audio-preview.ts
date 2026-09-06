"use client";

import * as React from "react";

/**
 * Auditions an audio file before it goes on the timeline.
 *
 * Uploading a sound and having no way to hear it is a dead end — you would have
 * to drop it into the project just to find out what it is. This drives a single
 * shared `<audio>` element so starting one preview always stops the previous
 * one, and it never fights the editor's own timeline playback.
 */
export interface AudioPreview {
  /** Id of the asset currently previewing, or null. */
  playingId: string | null;
  /** 0–1 position through the previewing clip, for a progress affordance. */
  progress: number;
  toggle: (id: string, src: string) => void;
  stop: () => void;
}

export function useAudioPreview(): AudioPreview {
  const elementRef = React.useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);

  // One element for the whole panel, created lazily on first use.
  const getElement = React.useCallback(() => {
    if (!elementRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      // No crossOrigin: auditioning only plays the file, and demanding CORS
      // would make any un-headered host fail silently.
      elementRef.current = audio;
    }
    return elementRef.current;
  }, []);

  const stop = React.useCallback(() => {
    const audio = elementRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlayingId(null);
    setProgress(0);
  }, []);

  const toggle = React.useCallback(
    (id: string, src: string) => {
      const audio = getElement();

      if (playingId === id) {
        stop();
        return;
      }

      audio.pause();
      audio.src = src;
      audio.currentTime = 0;
      setProgress(0);
      setPlayingId(id);

      void audio.play().catch((error: unknown) => {
        // Autoplay policy or an unreachable file: drop back to a stopped state
        // rather than leaving a button stuck showing "playing".
        console.warn("[audio preview] playback failed:", error);
        setPlayingId(null);
      });
    },
    [getElement, playingId, stop],
  );

  // Track position and reset when the clip finishes.
  React.useEffect(() => {
    const audio = elementRef.current;
    if (!audio || !playingId) return;

    const onTime = () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    };
    const onEnded = () => {
      setPlayingId(null);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onEnded);
    };
  }, [playingId]);

  // Tear the element down on unmount so a preview can't outlive its panel.
  React.useEffect(
    () => () => {
      const audio = elementRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      elementRef.current = null;
    },
    [],
  );

  return { playingId, progress, toggle, stop };
}
