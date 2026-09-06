import { Request, Response } from "express";
import {
  createProjectSchema,
  getCanvasPreset,
  listProjectsSchema,
  parseProjectDocument,
  updateProjectSchema,
  type ProjectDocument as MotionDocument,
} from "@workspace/motion";
import { ApiResponse, AsyncHandler } from "@/common/utils/api-utils";
import { NotFoundError, ValidationError } from "@/common/utils/error-utils";
import { getAuth } from "@/common/helper/global";
import { logger } from "@/common/helper/logger";
import { ProjectModel, ProjectStatus, TemplateModel, ExportJobModel } from "@/core/models";
import { ProjectService } from "./project.service";

class ProjectController {
  /** POST /v1/projects */
  createProjectHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const body = createProjectSchema.parse(req.body);

    let seed: MotionDocument | undefined = body.document;

    if (body.templateSlug && !seed) {
      const template = await TemplateModel.findOne({ slug: body.templateSlug }).lean();
      if (!template) throw new NotFoundError("Template not found.");
      // Templates are stored as project documents but were still authored data;
      // validate before they become someone's project.
      seed = parseProjectDocument(template.projectData);
      await TemplateModel.updateOne({ slug: body.templateSlug }, { $inc: { usageCount: 1 } }).catch(() => {});
    }

    const document = ProjectService.buildInitialDocument(body.canvas, seed);

    const project = await ProjectModel.create({
      userId: ProjectService.toObjectId(userId, "user"),
      name: body.name,
      description: body.description ?? null,
      width: document.canvas.width,
      height: document.canvas.height,
      fps: document.canvas.fps,
      duration: document.canvas.duration,
      projectData: document,
      templateSlug: body.templateSlug ?? null,
      status: ProjectStatus.DRAFT,
      lastOpenedAt: new Date(),
      revision: 1,
    });

    logger.info("Project created", { projectId: project.id, userId, template: body.templateSlug });

    res.status(201).json(new ApiResponse("Project created.", ProjectService.toDetail(project)));
  });

  /** GET /v1/projects */
  listProjectsHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const query = listProjectsSchema.parse(req.query);
    const result = await ProjectService.list(userId, query);
    res.status(200).json(new ApiResponse("Projects loaded.", result));
  });

  /** GET /v1/projects/:id */
  getProjectHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const project = await ProjectService.getOwned(req.params.id as string, userId);

    // Fire-and-forget: a failed recency stamp must not fail opening the editor.
    ProjectModel.updateOne({ _id: project._id }, { lastOpenedAt: new Date() }).catch(() => {});

    res.status(200).json(new ApiResponse("Project loaded.", ProjectService.toDetail(project)));
  });

  /** PATCH /v1/projects/:id — the autosave endpoint. */
  updateProjectHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const body = updateProjectSchema.parse(req.body);
    const project = await ProjectService.getOwned(req.params.id as string, userId);

    if (body.name !== undefined) project.name = body.name;
    if (body.description !== undefined) project.description = body.description;
    if (body.status !== undefined) project.status = body.status;
    if (body.thumbnail !== undefined) {
      // Only accept an inline raster data URL; anything else could point the
      // dashboard at an arbitrary remote resource.
      if (body.thumbnail === null || /^data:image\/(png|jpeg|webp);base64,/.test(body.thumbnail)) {
        project.thumbnail = body.thumbnail;
      } else {
        throw new ValidationError("Thumbnail must be a PNG, JPEG or WebP data URL.");
      }
    }

    if (body.document) {
      await ProjectService.saveDocument(project, body.document, body.baseRevision);
    } else {
      await project.save();
    }

    res.status(200).json(
      new ApiResponse("Project saved.", {
        ...ProjectService.toSummary(project.toObject({ virtuals: true })),
        revision: project.revision,
      }),
    );
  });

  /** DELETE /v1/projects/:id */
  deleteProjectHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const project = await ProjectService.getOwned(req.params.id as string, userId);

    await ProjectModel.deleteOne({ _id: project._id });
    // Exports reference a project that no longer exists; drop them together so
    // the user's export history can't show orphans.
    await ExportJobModel.deleteMany({ projectId: project._id }).catch(() => {});

    logger.info("Project deleted", { projectId: project.id, userId });
    res.status(200).json(new ApiResponse("Project deleted."));
  });

  /** POST /v1/projects/:id/duplicate */
  duplicateProjectHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const source = await ProjectService.getOwned(req.params.id as string, userId);

    const copy = await ProjectModel.create({
      userId: source.userId,
      name: `${source.name} copy`.slice(0, 120),
      description: source.description,
      width: source.width,
      height: source.height,
      fps: source.fps,
      duration: source.duration,
      projectData: source.projectData,
      templateSlug: source.templateSlug,
      thumbnail: source.thumbnail,
      status: ProjectStatus.DRAFT,
      lastOpenedAt: new Date(),
      revision: 1,
    });

    res.status(201).json(new ApiResponse("Project duplicated.", ProjectService.toDetail(copy)));
  });

  /**
   * POST /v1/projects/:id/canvas — change format mid-project.
   * Rescales every layer so the composition survives the change.
   */
  changeCanvasHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const presetId = String(req.body?.preset ?? "");
    const preset = getCanvasPreset(presetId);
    if (!preset) throw new ValidationError("Unknown canvas preset.");

    const project = await ProjectService.getOwned(req.params.id as string, userId);
    const current = parseProjectDocument(project.projectData);

    const next = ProjectService.rescaleDocument(current, {
      width: preset.width,
      height: preset.height,
      fps: current.canvas.fps,
      duration: current.canvas.duration,
    });

    await ProjectService.saveDocument(project, parseProjectDocument(next));
    res.status(200).json(new ApiResponse("Canvas updated.", ProjectService.toDetail(project)));
  });
}

export default new ProjectController();
