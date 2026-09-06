"use client";

import * as React from "react";
import { resolveLayerAtTime } from "@workspace/motion";
import { useEditorStore } from "../../stores/editor-store";

/**
 * Inline text editing on the canvas.
 *
 * Double-clicking a text layer opens a real `<textarea>` positioned exactly
 * over the Konva node and styled with the layer's own typography, so what the
 * user types looks like what they will get. The Konva text node hides itself
 * while this is open (see `TextContent`) so the two never double up.
 *
 * Edits are transient until the editor closes, which keeps a whole typing
 * session as one undo step rather than one per keystroke.
 */
export function InlineTextEditor({ scale }: { scale: number }) {
  const editingId = useEditorStore((s) => s.editingTextLayerId);
  const doc = useEditorStore((s) => s.document);
  const currentTime = useEditorStore((s) => s.currentTime);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const layer = React.useMemo(
    () => (editingId ? doc?.layers.find((l) => l.id === editingId) : undefined),
    [doc?.layers, editingId],
  );

  React.useEffect(() => {
    if (!editingId) return;
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [editingId]);

  if (!editingId || !layer || layer.type !== "text") return null;

  const resolved = resolveLayerAtTime(layer, currentTime);
  const p = layer.properties;

  const close = () => {
    const store = useEditorStore.getState();
    store.setEditingTextLayer(null);
    // Promote the accumulated transient edits into one history entry.
    store.updateLayer(layer.id, (l) => l);
  };

  return (
    <textarea
      ref={textareaRef}
      value={p.text}
      aria-label={`Edit text for ${layer.name}`}
      onChange={(event) => {
        const value = event.target.value;
        useEditorStore.getState().updateLayer(
          layer.id,
          (l) => (l.type === "text" ? { ...l, properties: { ...l.properties, text: value } } : l),
          { transient: true },
        );
      }}
      onBlur={close}
      onKeyDown={(event) => {
        // Enter commits, Shift+Enter adds a line — the convention for a
        // single-field editor embedded in a canvas.
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          close();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
        // Everything else stays local so global shortcuts don't fire.
        event.stopPropagation();
      }}
      style={{
        position: "absolute",
        // Konva positions on the centre; translate the box back by half.
        left: resolved.x * scale,
        top: resolved.y * scale,
        width: resolved.width * scale,
        height: resolved.height * scale,
        transform: `translate(-50%, -50%) rotate(${resolved.rotation}deg) scale(${resolved.scaleX}, ${resolved.scaleY})`,
        transformOrigin: "center center",
        padding: `${p.paddingY * scale}px ${p.paddingX * scale}px`,
        // Scale typography by the viewport zoom so the overlay lines up with
        // the rasterised Konva text underneath.
        fontFamily: `${p.fontFamily}, Inter, system-ui, sans-serif`,
        fontSize: p.fontSize * scale,
        fontWeight: p.fontWeight,
        fontStyle: p.fontStyle,
        lineHeight: p.lineHeight,
        letterSpacing: `${p.letterSpacing * scale}px`,
        textAlign: p.align,
        textTransform: p.textTransform === "none" ? undefined : p.textTransform,
        color: p.color,
        background: p.backgroundColor ?? "transparent",
        borderRadius: p.backgroundRadius * scale,
        outline: "2px solid var(--primary)",
        outlineOffset: 1,
        border: "none",
        resize: "none",
        overflow: "hidden",
        margin: 0,
        display: "block",
      }}
    />
  );
}
