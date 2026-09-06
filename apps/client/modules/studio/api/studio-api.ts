import type {
  AdvertisementPlan,
  AssetKind,
  CanvasConfig,
  ExportFormat,
  ExportJobView,
  ExportQuality,
  GenerateAdvertisementInput,
  Paginated,
  ProjectDocument,
  TemplateCategory,
} from "@workspace/motion";
import ApiServices from "@/data-access/api";
import type { GenericApiResponse } from "@/data-access/types";

/**
 * Studio server state, injected into the app's existing RTK Query instance so
 * it shares the same base query, auth refresh and cache as the rest of the app.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  status: "DRAFT" | "READY" | "EXPORTED" | "ARCHIVED";
  thumbnail: string | null;
  templateSlug: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  document: ProjectDocument;
}

export interface AssetRecord {
  id: string;
  type: AssetKind;
  status: "PENDING" | "READY" | "FAILED";
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url: string;
  thumbnailUrl: string | null;
  metadata: { width?: number; height?: number; duration?: number };
  error: string | null;
  createdAt: string;
}

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  featured: boolean;
  thumbnail: string | null;
  accent: string[];
  width: number;
  height: number;
  duration: number;
  sceneCount: number;
  layerCount: number;
  usageCount: number;
}

export interface TemplateDetail extends TemplateSummary {
  projectData: ProjectDocument;
}

export interface UploadTicket {
  uploadUrl: string;
  headers: Record<string, string>;
  storagePath: string;
  publicUrl: string;
  expiresAt: string;
}

export interface ExportJobResponse extends ExportJobView {
  estimatedSeconds?: number;
}

/** The server always wraps payloads in this envelope. */
interface Envelope<T> {
  status: "success";
  message: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const StudioApi = ApiServices.injectEndpoints({
  endpoints: (build) => ({
    // ---- Projects ---------------------------------------------------------

    listProjects: build.query<
      Paginated<ProjectSummary>,
      { page?: number; limit?: number; search?: string; status?: string } | void
    >({
      query: (params) => ({ url: "/projects", method: "GET", params: params ?? {} }),
      transformResponse: (response: Envelope<Paginated<ProjectSummary>>) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "PROJECTS" as const, id })),
              { type: "PROJECTS" as const, id: "LIST" },
            ]
          : [{ type: "PROJECTS" as const, id: "LIST" }],
    }),

    getProject: build.query<ProjectDetail, string>({
      query: (id) => ({ url: `/projects/${id}`, method: "GET" }),
      transformResponse: (response: Envelope<ProjectDetail>) => response.data,
      providesTags: (_r, _e, id) => [{ type: "PROJECT", id }],
    }),

    createProject: build.mutation<
      ProjectDetail,
      { name: string; description?: string; canvas: CanvasConfig; templateSlug?: string; document?: ProjectDocument }
    >({
      query: (body) => ({ url: "/projects", method: "POST", body }),
      transformResponse: (response: Envelope<ProjectDetail>) => response.data,
      invalidatesTags: [{ type: "PROJECTS", id: "LIST" }],
    }),

    /**
     * The autosave endpoint. It intentionally does **not** invalidate
     * `PROJECT` — refetching the document the user is actively editing would
     * stomp their in-flight changes.
     */
    updateProject: build.mutation<
      ProjectSummary,
      {
        id: string;
        name?: string;
        description?: string | null;
        document?: ProjectDocument;
        thumbnail?: string | null;
        status?: ProjectSummary["status"];
        baseRevision?: number;
      }
    >({
      query: ({ id, ...body }) => ({ url: `/projects/${id}`, method: "PATCH", body }),
      transformResponse: (response: Envelope<ProjectSummary>) => response.data,
      invalidatesTags: [{ type: "PROJECTS", id: "LIST" }],
    }),

    deleteProject: build.mutation<GenericApiResponse, string>({
      query: (id) => ({ url: `/projects/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "PROJECTS", id: "LIST" }],
    }),

    duplicateProject: build.mutation<ProjectDetail, string>({
      query: (id) => ({ url: `/projects/${id}/duplicate`, method: "POST" }),
      transformResponse: (response: Envelope<ProjectDetail>) => response.data,
      invalidatesTags: [{ type: "PROJECTS", id: "LIST" }],
    }),

    // ---- Templates --------------------------------------------------------

    listTemplates: build.query<
      { items: TemplateSummary[]; categories: readonly TemplateCategory[] },
      { category?: string; search?: string; featured?: boolean } | void
    >({
      query: (params) => ({ url: "/templates", method: "GET", params: params ?? {} }),
      transformResponse: (
        response: Envelope<{ items: TemplateSummary[]; categories: readonly TemplateCategory[] }>,
      ) => response.data,
      providesTags: [{ type: "TEMPLATES", id: "LIST" }],
    }),

    getTemplate: build.query<TemplateDetail, string>({
      query: (slug) => ({ url: `/templates/${slug}`, method: "GET" }),
      transformResponse: (response: Envelope<TemplateDetail>) => response.data,
      providesTags: (_r, _e, slug) => [{ type: "TEMPLATES", id: slug }],
    }),

    // ---- Assets -----------------------------------------------------------

    listAssets: build.query<
      Paginated<AssetRecord>,
      { page?: number; limit?: number; kind?: AssetKind; projectId?: string; search?: string } | void
    >({
      query: (params) => ({ url: "/assets", method: "GET", params: params ?? {} }),
      transformResponse: (response: Envelope<Paginated<AssetRecord>>) => response.data,
      providesTags: [{ type: "ASSETS", id: "LIST" }],
    }),

    requestUploadUrl: build.mutation<
      UploadTicket,
      { kind: AssetKind; filename: string; mimeType: string; size: number; projectId?: string }
    >({
      query: (body) => ({ url: "/assets/upload-url", method: "POST", body }),
      transformResponse: (response: Envelope<UploadTicket>) => response.data,
    }),

    confirmUpload: build.mutation<
      AssetRecord,
      {
        storagePath: string;
        kind: AssetKind;
        filename: string;
        mimeType: string;
        size: number;
        projectId?: string;
        metadata?: { width?: number; height?: number; duration?: number };
      }
    >({
      query: (body) => ({ url: "/assets/confirm", method: "POST", body }),
      transformResponse: (response: Envelope<AssetRecord>) => response.data,
      invalidatesTags: [{ type: "ASSETS", id: "LIST" }],
    }),

    getAsset: build.query<AssetRecord, string>({
      query: (id) => ({ url: `/assets/${id}`, method: "GET" }),
      transformResponse: (response: Envelope<AssetRecord>) => response.data,
    }),

    deleteAsset: build.mutation<GenericApiResponse, string>({
      query: (id) => ({ url: `/assets/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "ASSETS", id: "LIST" }],
    }),

    // ---- Exports ----------------------------------------------------------

    createExport: build.mutation<
      ExportJobResponse,
      { projectId: string; format: ExportFormat; quality: ExportQuality; fps?: number }
    >({
      query: ({ projectId, ...body }) => ({ url: `/projects/${projectId}/exports`, method: "POST", body }),
      transformResponse: (response: Envelope<ExportJobResponse>) => response.data,
      invalidatesTags: [{ type: "EXPORTS", id: "LIST" }],
    }),

    getExport: build.query<ExportJobResponse, string>({
      query: (id) => ({ url: `/exports/${id}`, method: "GET" }),
      transformResponse: (response: Envelope<ExportJobResponse>) => response.data,
      providesTags: (_r, _e, id) => [{ type: "EXPORTS", id }],
    }),

    listProjectExports: build.query<{ items: ExportJobView[] }, string>({
      query: (projectId) => ({ url: `/projects/${projectId}/exports`, method: "GET" }),
      transformResponse: (response: Envelope<{ items: ExportJobView[] }>) => response.data,
      providesTags: [{ type: "EXPORTS", id: "LIST" }],
    }),

    retryExport: build.mutation<ExportJobResponse, string>({
      query: (id) => ({ url: `/exports/${id}/retry`, method: "POST" }),
      transformResponse: (response: Envelope<ExportJobResponse>) => response.data,
      invalidatesTags: [{ type: "EXPORTS", id: "LIST" }],
    }),

    cancelExport: build.mutation<ExportJobResponse, string>({
      query: (id) => ({ url: `/exports/${id}/cancel`, method: "POST" }),
      transformResponse: (response: Envelope<ExportJobResponse>) => response.data,
      invalidatesTags: [{ type: "EXPORTS", id: "LIST" }],
    }),

    // ---- AI ---------------------------------------------------------------

    generateAdvertisement: build.mutation<
      { document: ProjectDocument; plan: AdvertisementPlan; generator: string; suggestedName: string },
      GenerateAdvertisementInput
    >({
      query: (body) => ({ url: "/ai/advertisements", method: "POST", body }),
      transformResponse: (
        response: Envelope<{
          document: ProjectDocument;
          plan: AdvertisementPlan;
          generator: string;
          suggestedName: string;
        }>,
      ) => response.data,
    }),
  }),
});

export const {
  useListProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useDuplicateProjectMutation,
  useListTemplatesQuery,
  useGetTemplateQuery,
  useLazyGetTemplateQuery,
  useListAssetsQuery,
  useRequestUploadUrlMutation,
  useConfirmUploadMutation,
  useLazyGetAssetQuery,
  useDeleteAssetMutation,
  useCreateExportMutation,
  useGetExportQuery,
  useListProjectExportsQuery,
  useRetryExportMutation,
  useCancelExportMutation,
  useGenerateAdvertisementMutation,
} = StudioApi;

export default StudioApi;
