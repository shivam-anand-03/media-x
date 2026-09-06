/**
 * `@workspace/motion` — the advertisement domain core.
 *
 * Deliberately free of React, Node and browser APIs so the same code backs the
 * editor, the API's validation layer and the Remotion render worker. If the
 * editor and the exported MP4 ever disagree, the bug is in a renderer, not here.
 */
export * from "./schema.js";
export * from "./animation.js";
export * from "./presets.js";
export * from "./layer-ops.js";
export * from "./export.js";
export * from "./templates/index.js";
export * from "./api.js";
