import { Router } from "express";
import aiController from "./ai.controller";

const aiRouter: Router = Router();

aiRouter.post("/advertisements", aiController.generateAdvertisementHandler);

export default aiRouter;
