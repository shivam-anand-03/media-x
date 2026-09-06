import { Router, raw } from "express";
import assetController from "./asset.controller";

const assetRouter: Router = Router();

/**
 * The local-driver upload target.
 *
 * Authorisation comes from the HMAC-signed ticket, which is bound to the exact
 * key, content type, size and expiry — so this stays a closed write endpoint
 * even though the browser PUTs raw bytes to it directly. `raw` gives the
 * handler a Buffer rather than express.json trying to parse an image.
 */
assetRouter.put(
  "/upload",
  raw({ type: "*/*", limit: "210mb" }),
  assetController.localUploadHandler,
);


assetRouter.post("/upload-url", assetController.requestUploadHandler);
assetRouter.post("/confirm", assetController.confirmUploadHandler);
assetRouter.get("/", assetController.listAssetsHandler);
assetRouter.get("/:id", assetController.getAssetHandler);
assetRouter.delete("/:id", assetController.deleteAssetHandler);

export default assetRouter;
