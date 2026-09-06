import { Router } from "express";
import { requireAuth } from "@/core/middleware/auth.middleware";
import exportController from "./export.controller";

const exportRouter: Router = Router();

exportRouter.use(requireAuth);

exportRouter.get("/:id", exportController.getExportHandler);
exportRouter.get("/:id/download", exportController.downloadExportHandler);
exportRouter.post("/:id/retry", exportController.retryExportHandler);
exportRouter.post("/:id/cancel", exportController.cancelExportHandler);

export default exportRouter;
