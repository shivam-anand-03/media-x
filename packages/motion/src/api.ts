import { z } from "zod";
import { canvasSchema, projectDocumentSchema } from "./schema";
import { exportRequestSchema } from "./export";

/**
 * Request contracts for the studio API.
 *
 * Shared by both sides: the Express handlers parse with these, and the client's
 * RTK Query endpoints are typed from them. A field can therefore never drift
 * between what the form sends and what the server accepts.
 */

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Give your advertisement a name").max(120),
  description: z.string().trim().max(500).optional(),
  canvas: canvasSchema,
  /** Start from a template instead of a blank canvas. */
  templateSlug: z.string().max(80).optional(),
  /** Seed the project with a full document (used by the AI generator). */
  document: projectDocumentSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    document: projectDocumentSchema.optional(),
    /** Data URL of a freshly captured poster frame. */
    thumbnail: z.string().max(2_000_000).nullable().optional(),
    status: z.enum(["DRAFT", "READY", "EXPORTED", "ARCHIVED"]).optional(),
    /**
     * Revision the client based this edit on. When present and stale the API
     * rejects the write instead of letting a second tab silently overwrite a
     * newer save.
     */
    baseRevision: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "READY", "EXPORTED", "ARCHIVED"]).optional(),
});
export type ListProjectsInput = z.infer<typeof listProjectsSchema>;

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const ASSET_KINDS = ["IMAGE", "VIDEO", "AUDIO", "LOGO"] as const;
export const assetKindSchema = z.enum(ASSET_KINDS);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const requestUploadSchema = z.object({
  kind: assetKindSchema,
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  size: z.number().int().positive(),
  projectId: z.string().max(64).optional(),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

export const confirmUploadSchema = z.object({
  storagePath: z.string().min(1).max(512),
  kind: assetKindSchema,
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  size: z.number().int().positive(),
  projectId: z.string().max(64).optional(),
  /** Intrinsic dimensions/duration the browser already measured. */
  metadata: z
    .object({
      width: z.number().int().positive().max(20000).optional(),
      height: z.number().int().positive().max(20000).optional(),
      duration: z.number().positive().max(7200).optional(),
    })
    .optional(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const listAssetsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  kind: assetKindSchema.optional(),
  projectId: z.string().max(64).optional(),
  search: z.string().trim().max(120).optional(),
});
export type ListAssetsInput = z.infer<typeof listAssetsSchema>;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const listTemplatesSchema = z.object({
  category: z.string().max(60).optional(),
  search: z.string().trim().max(120).optional(),
  featured: z.coerce.boolean().optional(),
});
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const createExportSchema = exportRequestSchema;
export type CreateExportInput = z.infer<typeof createExportSchema>;

// ---------------------------------------------------------------------------
// AI generation (§36)
// ---------------------------------------------------------------------------

export const AI_STYLES = ["modern", "bold", "minimal", "playful", "elegant", "technical"] as const;
export const aiStyleSchema = z.enum(AI_STYLES);
export type AiStyle = z.infer<typeof aiStyleSchema>;

export const generateAdvertisementSchema = z.object({
  subject: z.string().trim().min(2, "Tell us what you're promoting").max(120),
  description: z.string().trim().min(10, "Add a little more detail").max(1200),
  style: aiStyleSchema.default("modern"),
  /** A canvas preset id from `CANVAS_PRESETS`. */
  preset: z.string().max(60).default("instagram-reel"),
  duration: z.number().min(3).max(60).default(10),
  /** Optional brand colours the plan should build around. */
  palette: z.array(z.string().max(9)).max(6).optional(),
});
export type GenerateAdvertisementInput = z.infer<typeof generateAdvertisementSchema>;

/**
 * The structured plan an LLM must return. Deliberately *not* the project
 * document: a model is far more reliable at producing a short content outline
 * than 200 lines of positioned layers, and a narrow schema is a much smaller
 * attack surface. The plan is deterministically compiled into a document
 * server-side, so raw model output never reaches the editor (§36).
 */
export const advertisementPlanSchema = z.object({
  headline: z.string().trim().min(1).max(60),
  subheadline: z.string().trim().max(90).optional(),
  scenes: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(60),
        body: z.string().trim().max(140).optional(),
        caption: z.string().trim().max(50).optional(),
        /** Must be one of `ICON_LIBRARY`; anything else is dropped. */
        icon: z.string().max(40).optional(),
      }),
    )
    .min(1)
    .max(5),
  cta: z.string().trim().min(1).max(30),
  palette: z.array(z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)).min(2).max(5),
  backgroundStyle: z.enum(["dark", "light", "gradient"]).default("gradient"),
});
export type AdvertisementPlan = z.infer<typeof advertisementPlanSchema>;

// ---------------------------------------------------------------------------
// Shared response envelope (matches the server's ApiResponse)
// ---------------------------------------------------------------------------

export interface StudioApiResponse<T> {
  status: "success";
  message: string;
  data: T;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
