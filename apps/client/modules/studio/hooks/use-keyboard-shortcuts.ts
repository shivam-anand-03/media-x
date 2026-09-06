"use client";

import { useEffect } from "react";
import { useEditorStore } from "../stores/editor-store";

/**
 * Editor keyboard shortcuts (§24).
 *
 * Bound on `window` so they work wherever focus sits in the editor chrome, but
 * suppressed whenever the user is typing — otherwise Delete would erase a
 * layer while someone edits its name, and Space would play the timeline mid
 * sentence.
 */

export interface ShortcutHandlers {
  onSave: () => void;
  onExport?: () => void;
  onPreview?: () => void;
  onShowShortcuts?: () => void;
}

const NUDGE_SMALL = 1;
const NUDGE_LARGE = 10;

/** True when the event originates from a text entry surface. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    // Radix/Base UI menus and comboboxes handle their own keys.
    target.closest('[role="menu"],[role="listbox"],[role="dialog"] input') !== null
  );
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const store = useEditorStore.getState();
      const mod = event.metaKey || event.ctrlKey;

      // Escape always works: it is the way out of inline text editing.
      if (event.key === "Escape") {
        if (store.editingTextLayerId) {
          store.setEditingTextLayer(null);
          event.preventDefault();
          return;
        }
        if (store.selectedLayerIds.length) {
          store.clearSelection();
          event.preventDefault();
        }
        return;
      }

      if (isTypingTarget(event.target)) return;
      // Inline canvas text editing owns every key while it is open.
      if (store.editingTextLayerId) return;

      // ---- Modifier combinations -----------------------------------------
      if (mod) {
        switch (event.key.toLowerCase()) {
          case "z":
            event.preventDefault();
            // Cmd+Shift+Z is the platform-standard redo alongside Cmd+Y.
            if (event.shiftKey) store.redo();
            else store.undo();
            return;
          case "y":
            event.preventDefault();
            store.redo();
            return;
          case "c":
            event.preventDefault();
            store.copySelection();
            return;
          case "x":
            event.preventDefault();
            store.cutSelection();
            return;
          case "v":
            event.preventDefault();
            store.paste();
            return;
          case "d":
            event.preventDefault();
            store.duplicateSelectedLayers();
            return;
          case "a":
            event.preventDefault();
            store.selectAll();
            return;
          case "s":
            event.preventDefault();
            handlers.onSave();
            return;
          case "e":
            if (handlers.onExport) {
              event.preventDefault();
              handlers.onExport();
            }
            return;
          case "p":
            if (handlers.onPreview) {
              event.preventDefault();
              handlers.onPreview();
            }
            return;
          case "]":
            event.preventDefault();
            store.reorderSelectedLayers(event.shiftKey ? "front" : "forward");
            return;
          case "[":
            event.preventDefault();
            store.reorderSelectedLayers(event.shiftKey ? "back" : "backward");
            return;
          case "0":
            event.preventDefault();
            store.setFitToScreen(true);
            return;
          case "=":
          case "+":
            event.preventDefault();
            store.setZoom(store.zoom * 1.2);
            return;
          case "-":
            event.preventDefault();
            store.setZoom(store.zoom / 1.2);
            return;
          default:
            return;
        }
      }

      // ---- Unmodified keys ------------------------------------------------
      switch (event.key) {
        case "Delete":
        case "Backspace":
          event.preventDefault();
          store.removeSelectedLayers();
          return;

        case " ":
          event.preventDefault();
          store.togglePlay();
          return;

        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
          const step = event.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;

          // With nothing selected the arrows scrub the timeline instead — the
          // natural meaning when the canvas has no focus target.
          if (store.selectedLayerIds.length === 0) {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              const delta = (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : 1 / 30);
              store.setCurrentTime(store.currentTime + delta);
            }
            return;
          }

          event.preventDefault();
          const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
          const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
          store.nudgeSelection(dx, dy);
          return;
        }

        case "Home":
          event.preventDefault();
          store.setCurrentTime(0);
          return;

        case "End":
          event.preventDefault();
          store.setCurrentTime(store.document?.canvas.duration ?? 0);
          return;

        case "?":
          if (handlers.onShowShortcuts) {
            event.preventDefault();
            handlers.onShowShortcuts();
          }
          return;

        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handlers]);
}

/** Rendered by the shortcuts dialog, and the single source for the key list. */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Editing",
    items: [
      { keys: ["Del"], label: "Delete selection" },
      { keys: ["Mod", "Z"], label: "Undo" },
      { keys: ["Mod", "Shift", "Z"], label: "Redo" },
      { keys: ["Mod", "Y"], label: "Redo" },
      { keys: ["Mod", "C"], label: "Copy" },
      { keys: ["Mod", "X"], label: "Cut" },
      { keys: ["Mod", "V"], label: "Paste" },
      { keys: ["Mod", "D"], label: "Duplicate" },
      { keys: ["Mod", "A"], label: "Select all" },
      { keys: ["Esc"], label: "Clear selection" },
    ],
  },
  {
    title: "Arrange",
    items: [
      { keys: ["↑", "↓", "←", "→"], label: "Move by 1px" },
      { keys: ["Shift", "Arrows"], label: "Move by 10px" },
      { keys: ["Mod", "]"], label: "Bring forward" },
      { keys: ["Mod", "["], label: "Send backward" },
      { keys: ["Mod", "Shift", "]"], label: "Bring to front" },
      { keys: ["Mod", "Shift", "["], label: "Send to back" },
    ],
  },
  {
    title: "Playback",
    items: [
      { keys: ["Space"], label: "Play / pause" },
      { keys: ["←", "→"], label: "Step one frame" },
      { keys: ["Home"], label: "Jump to start" },
      { keys: ["End"], label: "Jump to end" },
    ],
  },
  {
    title: "Project",
    items: [
      { keys: ["Mod", "S"], label: "Save now" },
      { keys: ["Mod", "P"], label: "Preview" },
      { keys: ["Mod", "E"], label: "Export" },
      { keys: ["Mod", "0"], label: "Fit to screen" },
      { keys: ["Mod", "+"], label: "Zoom in" },
      { keys: ["Mod", "−"], label: "Zoom out" },
      { keys: ["?"], label: "Show shortcuts" },
    ],
  },
];
