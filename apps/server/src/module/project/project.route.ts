import { Router } from "express";
import projectController from "./project.controller";
import exportController from "../export/export.controller";

const projectRouter: Router = Router();

// Every project route is owner-scoped; there is no public project view.

projectRouter.post("/", projectController.createProjectHandler);
projectRouter.get("/", projectController.listProjectsHandler);
projectRouter.get("/:id", projectController.getProjectHandler);
projectRouter.patch("/:id", projectController.updateProjectHandler);
projectRouter.delete("/:id", projectController.deleteProjectHandler);
projectRouter.post("/:id/duplicate", projectController.duplicateProjectHandler);
projectRouter.post("/:id/canvas", projectController.changeCanvasHandler);

// Exports are nested under the project they belong to (§33).
projectRouter.post("/:id/exports", exportController.createExportHandler);
projectRouter.get("/:id/exports", exportController.listProjectExportsHandler);

export default projectRouter;
