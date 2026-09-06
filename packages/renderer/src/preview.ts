/**
 * Browser-safe entry point for the shared renderer.
 *
 * Everything here is plain React with no Remotion runtime, so the editor can
 * import it without pulling `registerRoot` into the client bundle.
 */
export { AdvertisementStage, type AdvertisementStageProps } from "./AdvertisementStage.js";
export { LayerRenderer, type LayerRendererProps } from "./LayerRenderer.js";
export { IconGlyph, getIconComponent } from "./IconGlyph.js";
export * from "./layer-style.js";
