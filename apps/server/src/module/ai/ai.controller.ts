import { Request, Response } from "express";
import { generateAdvertisementSchema, getCanvasPreset } from "@workspace/motion";
import { ApiResponse, AsyncHandler } from "@/common/utils/api-utils";
import { ValidationError } from "@/common/utils/error-utils";
import { getAuth } from "@/common/helper/global";
import { logger } from "@/common/helper/logger";
import { planAdvertisement } from "./ad-planner";
import { compilePlanToDocument } from "./plan-compiler";

class AiController {
  /**
   * POST /v1/ai/advertisements
   *
   * Returns a *document*, not a project: the client reviews it and then creates
   * a project from it through the normal create endpoint, which validates it
   * again. Generation never writes to the database on its own.
   */
  generateAdvertisementHandler = AsyncHandler(async (req: Request, res: Response) => {
    const { userId } = await getAuth(req);
    const input = generateAdvertisementSchema.parse(req.body);

    const preset = getCanvasPreset(input.preset);
    if (!preset) throw new ValidationError("Unknown canvas preset.");

    const { plan, source } = await planAdvertisement(input);

    const document = compilePlanToDocument(plan, {
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      duration: input.duration,
    });

    logger.info("Advertisement generated", {
      userId,
      source,
      scenes: document.scenes.length,
      layers: document.layers.length,
    });

    res.status(200).json(
      new ApiResponse("Advertisement generated.", {
        document,
        plan,
        // Surfaced so the UI can say when it fell back to the offline planner.
        generator: source,
        suggestedName: plan.headline.slice(0, 60),
      }),
    );
  });
}

export default new AiController();
