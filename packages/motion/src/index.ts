/**
 * `@workspace/motion` — the advertisement domain core.
 *
 * Deliberately free of React, Node and browser APIs so the same code backs the
 * editor, the API's validation layer and the Remotion render worker. If the
 * editor and the exported MP4 ever disagree, the bug is in a renderer, not here.
 */
export * from "./schema";
export * from "./animation";
export * from "./presets";
export * from "./layer-ops";
export * from "./export";
export * from "./templates/index";
export * from "./api";
