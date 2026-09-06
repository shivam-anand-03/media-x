"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "../stores/editor-store";
import { useUpdateProjectMutation } from "../api/studio-api";

/**
 * Debounced autosave (§26).
 *
 * The editor writes to Zustand on every keystroke and every pixel of a drag;
 * this hook is the only thing that talks to the API. It watches `dirtyCounter`
 * — a single integer bumped by any document mutation — so it never has to diff
 * documents, and it saves at most once per `delay` no matter how fast the user
 * works.
 *
 * Offline is treated as "not yet saved" rather than an error: the document
 * lives in memory, the indicator says so, and the pending save is flushed as
 * soon as the connection returns.
 */

const DEFAULT_DELAY = 1200;
/** Never let a long editing streak go unsaved for more than this. */
const MAX_WAIT = 8000;

export function useAutosave(options?: { delay?: number; enabled?: boolean }) {
  const delay = options?.delay ?? DEFAULT_DELAY;
  const enabled = options?.enabled ?? true;

  const [updateProject] = useUpdateProjectMutation();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirtyAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  /** Set when a save is requested while one is already running. */
  const rerunRequested = useRef(false);

  const save = useCallback(async () => {
    const state = useEditorStore.getState();
    const { projectId, document, projectName, revision } = state;

    if (!projectId || !document) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      state.setSaveState("offline");
      return;
    }

    if (inFlight.current) {
      rerunRequested.current = true;
      return;
    }

    inFlight.current = true;
    firstDirtyAt.current = null;
    state.setSaveState("saving");

    // Capture the counter *before* awaiting: anything the user changes during
    // the request must leave the project dirty afterwards.
    const savedAtCounter = state.dirtyCounter;

    try {
      const result = await updateProject({
        id: projectId,
        name: projectName,
        document,
        baseRevision: revision,
      }).unwrap();

      const after = useEditorStore.getState();
      after.markSaved(result.revision);

      // Edits landed mid-flight: stay dirty and schedule another pass.
      if (after.dirtyCounter !== savedAtCounter) {
        after.setSaveState("dirty");
        rerunRequested.current = true;
      }
    } catch (error) {
      const message = extractMessage(error);
      useEditorStore.getState().setSaveState("error", message);
    } finally {
      inFlight.current = false;
      if (rerunRequested.current) {
        rerunRequested.current = false;
        // Re-enter through the debounce rather than recursing immediately.
        timer.current = setTimeout(() => void save(), delay);
      }
    }
  }, [updateProject, delay]);

  /** Save now, bypassing the debounce — Cmd+S and "leaving the editor". */
  const saveNow = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await save();
  }, [save]);

  // Debounce on the dirty counter.
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = useEditorStore.subscribe(
      (s) => s.dirtyCounter,
      (counter) => {
        if (counter === 0) return;
        if (timer.current) clearTimeout(timer.current);

        // Start the max-wait clock on the first edit of a burst so continuous
        // editing still gets persisted periodically.
        if (firstDirtyAt.current === null) firstDirtyAt.current = Date.now();
        const waited = Date.now() - firstDirtyAt.current;

        if (waited >= MAX_WAIT) {
          void save();
          return;
        }
        timer.current = setTimeout(() => void save(), Math.min(delay, MAX_WAIT - waited));
      },
    );

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, delay, save]);

  // Flush pending work when the connection comes back, and when the tab is
  // hidden (a closing tab is the most likely moment to lose an edit).
  useEffect(() => {
    if (!enabled) return;

    const onOnline = () => {
      const state = useEditorStore.getState();
      if (state.saveState === "offline" || state.saveState === "error" || state.saveState === "dirty") {
        state.setSaveState("saving");
        void save();
      }
    };
    const onOffline = () => {
      const state = useEditorStore.getState();
      if (state.saveState !== "saved") state.setSaveState("offline");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && useEditorStore.getState().saveState === "dirty") {
        void save();
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, save]);

  // Warn before losing unsaved work.
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      const { saveState } = useEditorStore.getState();
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);

  return { saveNow };
}

function extractMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const err = error as { data?: { message?: string; details?: { error?: string } }; status?: number };
    if (err.data?.details?.error === "REVISION_CONFLICT") {
      return "This project was changed in another tab. Reload to continue editing.";
    }
    if (err.data?.message) return err.data.message;
    if (err.status === 401) return "Your session expired. Sign in again to keep saving.";
  }
  return "We couldn't save your changes. Retrying automatically.";
}
