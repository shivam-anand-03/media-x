import { Router } from "express";
import { requireAuth } from "@/core/middleware/auth.middleware";
import aiController from "./ai.controller";

const aiRouter: Router = Router();

aiRouter.use(requireAuth);
aiRouter.post("/advertisements", aiController.generateAdvertisementHandler);

export default aiRouter;
