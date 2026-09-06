"use client";

import * as React from "react";

/**
 * Remembers a resizable panel layout per browser.
 *
 * `react-resizable-panels` v4 drops the old `autoSaveId`, so persistence is
 * wired up here instead: the group reports its layout, we store it, and the
 * next mount hands it straight back as `defaultLayout`.
 *
 * The stored value is only read once, on mount, to avoid a hydration mismatch
 * — the server has no idea what the user dragged last time.
 */
export type PanelLayout = Record<string, number>;

export function usePersistedLayout(key: string) {
  const storageKey = `motion-studio:layout:${key}`;
  const [defaultLayout, setDefaultLayout] = React.useState<PanelLayout | undefined>(undefined);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setDefaultLayout(parsed as PanelLayout);
      }
    } catch {
      // Blocked storage or corrupt JSON — fall back to the default layout.
    }
  }, [storageKey]);

  const onLayoutChanged = React.useCallback(
    (layout: PanelLayout) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(layout));
      } catch {
        // Remembering a panel width is a nicety; never surface a failure.
      }
    },
    [storageKey],
  );

  return { defaultLayout, onLayoutChanged };
}
