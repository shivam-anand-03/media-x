import { Request, Response } from "express";
import {
  listTemplatesSchema,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LIBRARY,
  type TemplateDefinition,
} from "@workspace/motion";
import { ApiResponse, AsyncHandler } from "@/common/utils/api-utils";
import { NotFoundError } from "@/common/utils/error-utils";
import { logger } from "@/common/helper/logger";
import { TemplateModel } from "@/core/models";

/**
 * The template library.
 *
 * Templates are seeded from `@workspace/motion` on boot so a fresh database is
 * never empty, and the seeder is an upsert keyed on slug — restarting the
 * server updates definitions in place instead of duplicating them.
 */
class TemplateController {
  /** GET /v1/templates */
  listTemplatesHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { category, search, featured } = listTemplatesSchema.parse(req.query);

    const filter: Record<string, unknown> = {};
    if (category && category !== "Featured") {
      // A template lists under its primary category or any of its tags.
      filter.$or = [{ category }, { tags: category }];
    }
    if (category === "Featured" || featured) filter.featured = true;
    if (search) {
      const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      filter.$and = [{ $or: [{ name: rx }, { description: rx }, { tags: rx }] }];
    }

    const templates = await TemplateModel.find(filter)
      .select("-projectData")
      .sort({ featured: -1, usageCount: -1, name: 1 })
      .lean({ virtuals: true });

    res.status(200).json(
      new ApiResponse("Templates loaded.", {
        items: templates.map((t: any) => ({ ...t, id: t._id?.toString() ?? t.id })),
        categories: TEMPLATE_CATEGORIES,
      }),
    );
  });

  /** GET /v1/templates/:slug — includes the full document for preview. */
  getTemplateHandler = AsyncHandler(async (req: Request, res: Response) => {
    const template = await TemplateModel.findOne({ slug: req.params.slug }).lean({ virtuals: true });
    if (!template) throw new NotFoundError("Template not found.");
    res.status(200).json(
      new ApiResponse("Template loaded.", { ...template, id: (template as any)._id?.toString() }),
    );
  });
}

/** Upserts the bundled library. Safe to run on every boot. */
export async function seedTemplates(): Promise<void> {
  try {
    const operations = TEMPLATE_LIBRARY.map((definition: TemplateDefinition) => ({
      updateOne: {
        filter: { slug: definition.slug },
        update: {
          $set: {
            name: definition.name,
            description: definition.description,
            category: definition.category,
            tags: definition.tags,
            featured: definition.featured,
            accent: definition.accent,
            width: definition.document.canvas.width,
            height: definition.document.canvas.height,
            duration: definition.document.canvas.duration,
            sceneCount: definition.document.scenes.length,
            layerCount: definition.document.layers.length,
            projectData: definition.document,
          },
          // Never reset the counter on redeploy.
          $setOnInsert: { usageCount: 0 },
        },
        upsert: true,
      },
    }));

    const result = await TemplateModel.bulkWrite(operations, { ordered: false });
    logger.info("🎬 Templates seeded", {
      upserted: result.upsertedCount,
      updated: result.modifiedCount,
      total: TEMPLATE_LIBRARY.length,
    });
  } catch (error) {
    // Seeding is a convenience, not a precondition — never block startup on it.
    logger.error("Template seeding failed", { error });
  }
}

export default new TemplateController();
