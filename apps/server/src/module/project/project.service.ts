import { Types } from "mongoose";
import {
  parseProjectDocument,
  setProjectDuration,
  type CanvasConfig,
  type ProjectDocument as MotionDocument,
} from "@workspace/motion";
import { ForbiddenError, NotFoundError, ValidationError } from "@/common/utils/error-utils";
import { ProjectModel, type IProjectDocument } from "@/core/models";

/**
 * Project data access with ownership enforced at the query, not after it.
 *
 * Every lookup filters on `userId` in the same query that finds the document,
 * so there is no window in which a project belonging to someone else has been
 * loaded into memory and is one forgotten `if` away from leaking (§44).
 */
export class ProjectService {
  static toObjectId(id: string, label = "project"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError(`Invalid ${label} id.`);
    }
    return new Types.ObjectId(id);
  }

  /** Loads a project the user owns, or throws. */
  static async getOwned(projectId: string, userId: string): Promise<IProjectDocument> {
    const project = await ProjectModel.findOne({
      _id: ProjectService.toObjectId(projectId),
      userId: ProjectService.toObjectId(userId, "user"),
    });

    if (!project) {
      // Deliberately a 404, not a 403: telling a stranger that a project id
      // exists but is not theirs is itself a small leak.
      throw new NotFoundError("Project not found.");
    }
    return project;
  }

  /** Ownership check without pulling the (potentially large) document. */
  static async assertOwnership(projectId: string, userId: string): Promise<void> {
    const exists = await ProjectModel.exists({
      _id: ProjectService.toObjectId(projectId),
      userId: ProjectService.toObjectId(userId, "user"),
    });
    if (!exists) throw new NotFoundError("Project not found.");
  }

  /**
   * Builds the starting document for a new project. A supplied document (from
   * a template or the AI generator) is re-validated and re-fitted to the
   * chosen canvas so a 16:9 template dropped onto a 9:16 canvas cannot leave
   * clips hanging past the end of the timeline.
   */
  static buildInitialDocument(canvas: CanvasConfig, seed?: MotionDocument): MotionDocument {
    if (!seed) {
      return parseProjectDocument({
        version: 1,
        canvas,
        background: { type: "gradient", from: "#1e1065", to: "#05030c", angle: 165 },
        layers: [],
        audioTracks: [],
        scenes: [],
        palette: [],
      });
    }

    const scaled = ProjectService.rescaleDocument(seed, canvas);
    return parseProjectDocument(setProjectDuration(scaled, canvas.duration));
  }

  /**
   * Refits a document onto a different canvas.
   *
   * Positions and sizes are stored in canvas pixels, so a template authored at
   * 1080×1920 would sit in the corner of a 1920×1080 canvas untouched. Scaling
   * by the smaller axis ratio and re-centring keeps the composition intact and
   * guarantees nothing lands outside the frame.
   */
  static rescaleDocument(doc: MotionDocument, canvas: CanvasConfig): MotionDocument {
    const { width: fromW, height: fromH } = doc.canvas;
    if (fromW === canvas.width && fromH === canvas.height) {
      return { ...doc, canvas: { ...doc.canvas, ...canvas } };
    }

    const scale = Math.min(canvas.width / fromW, canvas.height / fromH);

    return {
      ...doc,
      canvas,
      layers: doc.layers.map((layer) => {
        const t = layer.transform;
        // Re-centre: offset from the old centre, scaled, applied to the new one.
        const nextTransform = {
          ...t,
          x: canvas.width / 2 + (t.x - fromW / 2) * scale,
          y: canvas.height / 2 + (t.y - fromH / 2) * scale,
          width: Math.max(1, t.width * scale),
          height: Math.max(1, t.height * scale),
        };

        if (layer.type === "text") {
          return {
            ...layer,
            transform: nextTransform,
            properties: {
              ...layer.properties,
              fontSize: Math.max(1, Math.round(layer.properties.fontSize * scale)),
              paddingX: Math.round(layer.properties.paddingX * scale),
              paddingY: Math.round(layer.properties.paddingY * scale),
            },
          };
        }
        return { ...layer, transform: nextTransform };
      }),
    };
  }

  /**
   * Persists a new document. Increments `revision` atomically and rejects a
   * write based on a stale one, so two open tabs cannot silently clobber each
   * other's autosaves.
   */
  static async saveDocument(
    project: IProjectDocument,
    document: MotionDocument,
    baseRevision?: number,
  ): Promise<IProjectDocument> {
    if (baseRevision !== undefined && baseRevision !== project.revision) {
      throw new ForbiddenError(
        "This project was changed somewhere else. Reload to get the latest version before saving.",
        { error: "REVISION_CONFLICT", currentRevision: project.revision },
      );
    }

    project.projectData = document;
    project.width = document.canvas.width;
    project.height = document.canvas.height;
    project.fps = document.canvas.fps;
    project.duration = document.canvas.duration;
    project.revision = project.revision + 1;
    await project.save();
    return project;
  }

  /** List view — never returns `projectData`; the dashboard doesn't need it and
   *  it would be megabytes across 24 cards. */
  static async list(
    userId: string,
    { page, limit, search, status }: { page: number; limit: number; search?: string; status?: string },
  ) {
    const filter: Record<string, unknown> = {
      userId: ProjectService.toObjectId(userId, "user"),
    };
    if (status) filter.status = status;
    if (search) {
      // Escaped so a user searching for "a(b" doesn't produce an invalid regex.
      filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const [items, total] = await Promise.all([
      ProjectModel.find(filter)
        .select("-projectData")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
      ProjectModel.countDocuments(filter),
    ]);

    return {
      items: items.map(ProjectService.toSummary),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  static toSummary(doc: Record<string, any>) {
    return {
      id: doc._id?.toString() ?? doc.id,
      name: doc.name,
      description: doc.description ?? null,
      width: doc.width,
      height: doc.height,
      fps: doc.fps,
      duration: doc.duration,
      status: doc.status,
      thumbnail: doc.thumbnail ?? null,
      templateSlug: doc.templateSlug ?? null,
      revision: doc.revision ?? 1,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lastOpenedAt: doc.lastOpenedAt ?? null,
    };
  }

  static toDetail(project: IProjectDocument) {
    return {
      ...ProjectService.toSummary(project.toObject({ virtuals: true })),
      document: project.projectData,
    };
  }
}
