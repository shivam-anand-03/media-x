import { Router, raw } from "express";
import { requireAuth } from "@/core/middleware/auth.middleware";
import assetController from "./asset.controller";

const assetRouter: Router = Router();

/**
 * The local-driver upload target.
 *
 * Mounted before `requireAuth` because the browser PUTs raw bytes here with no
 * cookies; authorisation comes from the HMAC-signed ticket instead, which is
 * bound to the exact key, content type, size and expiry. `raw` gives the
 * handler a Buffer rather than express.json trying to parse an image.
 */
assetRouter.put(
  "/upload",
  raw({ type: "*/*", limit: "210mb" }),
  assetController.localUploadHandler,
);

assetRouter.use(requireAuth);

assetRouter.post("/upload-url", assetController.requestUploadHandler);
assetRouter.post("/confirm", assetController.confirmUploadHandler);
assetRouter.get("/", assetController.listAssetsHandler);
assetRouter.get("/:id", assetController.getAssetHandler);
assetRouter.delete("/:id", assetController.deleteAssetHandler);

export default assetRouter;
