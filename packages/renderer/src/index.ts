import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

/**
 * Remotion bundle entry point. `RenderService` bundles this file and renders
 * the `Advertisement` composition from it.
 *
 * Non-Remotion consumers (the editor's preview player) should import
 * `./AdvertisementStage.js` directly rather than this module — importing it
 * would call `registerRoot` in the browser.
 */
registerRoot(RemotionRoot);

export { ADVERTISEMENT_COMPOSITION_ID } from "./Root";
