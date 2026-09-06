import { Router } from "express";
import templateController from "./template.controller";

const templateRouter: Router = Router();

// Templates are shared content, but still behind auth so the library is not a
// public scraping target.

templateRouter.get("/", templateController.listTemplatesHandler);
templateRouter.get("/:slug", templateController.getTemplateHandler);

export default templateRouter;
