import os from "os";
import path from "path";
import { promises as fs } from "fs";
import {
  QUALITY_SETTINGS,
  type ExportFormat,
  type ExportQuality,
  type ProjectDocument,
  type RenderStage,
} from "@workspace/motion";
import { envs } from "@/common/configs/envs.config";
import { logger } from "@/common/helper/logger";
import { objectStorage } from "@/common/services/object-storage.service";

/**
 * Drives Remotion + FFmpeg for one export (§12 of the implementation order).
 *
 * The heavy Remotion packages are imported lazily so an API-only instance —
 * or a dev machine without a Chromium download — can boot and serve the whole
 * app; only an actual render needs them present. When they are missing the
 * failure is a typed `WORKER_UNAVAILABLE`, which the client turns into
 * actionable copy rather than a stack trace (§31).
 */

/** A failure with a stable code the UI can map to friendly copy. */
export class RenderError extends Error {
  constructor(
    public readonly code:
      | "INVALID_PROJECT"
      | "ASSET_UNAVAILABLE"
      | "TIMEOUT"
      | "STORAGE_FAILED"
      | "WORKER_UNAVAILABLE"
      | "RENDER_FAILED",
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export interface RenderInput {
  document: ProjectDocument;
  exportJobId: string;
  format: ExportFormat;
  quality: ExportQuality;
  width: number;
  height: number;
  fps: number;
  onProgress: (stage: RenderStage, stageProgress: number) => Promise<void> | void;
}

export interface RenderOutput {
  url: string;
  storagePath: string;
  size: number;
}

const CODECS: Record<ExportFormat, "h264" | "vp8" | "gif"> = {
  mp4: "h264",
  webm: "vp8",
  gif: "gif",
};

const EXTENSIONS: Record<ExportFormat, string> = { mp4: "mp4", webm: "webm", gif: "gif" };
const CONTENT_TYPES: Record<ExportFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  gif: "image/gif",
};

/** Cached across renders — bundling is expensive and the entry never changes. */
let bundlePromise: Promise<string> | null = null;

export class RenderService {
  /**
   * Resolves the Remotion entry point. In dev it is the TypeScript source; in
   * a built server the same relative layout holds under `dist/`, and we fall
   * back to walking up to the workspace root if neither matches.
   */
  private static entryPoint(): string {
    const candidates = [
      path.resolve(__dirname, "../../../../packages/renderer/src/index.ts"),
      path.resolve(process.cwd(), "../../packages/renderer/src/index.ts"),
      path.resolve(process.cwd(), "packages/renderer/src/index.ts"),
    ];
    return candidates[0]!;
  }

  private static async bundle(): Promise<string> {
    if (bundlePromise) return bundlePromise;

    bundlePromise = (async () => {
      const { bundle } = await import("@remotion/bundler");
      const entry = await RenderService.resolveEntry();
      logger.info("Bundling Remotion composition", { entry });
      return bundle({
        entryPoint: entry,
        // Remotion runs its own webpack; the workspace aliases must be taught
        // to it or `@workspace/motion` will not resolve inside the bundle.
        webpackOverride: (config) => ({
          ...config,
          resolve: {
            ...config.resolve,
            alias: {
              ...(config.resolve?.alias ?? {}),
              "@workspace/motion": path.resolve(RenderService.packagesRoot(), "motion/src/index.ts"),
            },
          },
        }),
      });
    })();

    try {
      return await bundlePromise;
    } catch (error) {
      // Don't cache a failed bundle — the next attempt should retry cleanly.
      bundlePromise = null;
      throw error;
    }
  }

  private static packagesRoot(): string {
    return path.resolve(RenderService.entryPoint(), "../../..");
  }

  private static async resolveEntry(): Promise<string> {
    const candidates = [
      path.resolve(__dirname, "../../../../packages/renderer/src/index.ts"),
      path.resolve(process.cwd(), "../../packages/renderer/src/index.ts"),
      path.resolve(process.cwd(), "packages/renderer/src/index.ts"),
    ];
    for (const candidate of candidates) {
      if (await fs.stat(candidate).then(() => true).catch(() => false)) return candidate;
    }
    throw new RenderError(
      "WORKER_UNAVAILABLE",
      `Could not locate the Remotion entry point. Looked in: ${candidates.join(", ")}`,
    );
  }

  static async render(input: RenderInput): Promise<RenderOutput> {
    const { document: doc, exportJobId, format, quality, width, height, fps } = input;

    let renderer: typeof import("@remotion/renderer");
    try {
      renderer = await import("@remotion/renderer");
    } catch (error) {
      throw new RenderError(
        "WORKER_UNAVAILABLE",
        "Remotion renderer is not installed on this instance",
        error instanceof Error ? error.message : String(error),
      );
    }

    await input.onProgress("preparing", 0.1);

    const serveUrl = await RenderService.bundle().catch((error) => {
      throw new RenderError(
        "WORKER_UNAVAILABLE",
        "Failed to bundle the Remotion composition",
        error instanceof Error ? error.message : String(error),
      );
    });

    await input.onProgress("preparing", 0.6);

    const inputProps = { document: doc };
    const composition = await renderer
      .selectComposition({ serveUrl, id: "Advertisement", inputProps })
      .catch((error) => {
        throw new RenderError(
          "INVALID_PROJECT",
          "Remotion could not build a composition from this project",
          error instanceof Error ? error.message : String(error),
        );
      });

    await input.onProgress("preparing", 1);

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `motion-${exportJobId}-`));
    const outputPath = path.join(workDir, `advertisement.${EXTENSIONS[format]}`);

    try {
      const renderPromise = renderer.renderMedia({
        composition: {
          ...composition,
          width,
          height,
          fps,
          durationInFrames: Math.max(1, Math.round(doc.canvas.duration * fps)),
        },
        serveUrl,
        codec: CODECS[format],
        outputLocation: outputPath,
        inputProps,
        crf: format === "gif" ? undefined : QUALITY_SETTINGS[quality].crf,
        // Remotion drives FFmpeg internally for muxing and encoding.
        audioCodec: format === "mp4" ? "aac" : undefined,
        chromiumOptions: { gl: "swiftshader" },
        browserExecutable: envs.REMOTION_BROWSER_EXECUTABLE,
        concurrency: null,
        onProgress: ({ progress, encodedFrames, renderedFrames }) => {
          // Remotion's `progress` already blends rendering and encoding; split
          // it across our two stages so the label matches the bar.
          if (encodedFrames > 0 && renderedFrames >= composition.durationInFrames) {
            void input.onProgress("encoding", progress);
          } else {
            void input.onProgress("rendering", progress);
          }
        },
      });

      await RenderService.withTimeout(renderPromise, envs.RENDER_TIMEOUT_MS);
    } catch (error) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      if (error instanceof RenderError) throw error;

      const message = error instanceof Error ? error.message : String(error);
      // Distinguish "your media 404s" from "the renderer broke", because the
      // user can only act on the first one.
      if (/net::ERR|Failed to fetch|ENOTFOUND|404/i.test(message)) {
        throw new RenderError("ASSET_UNAVAILABLE", "A media asset could not be loaded during render", message);
      }
      throw new RenderError("RENDER_FAILED", "Remotion failed to render the composition", message);
    }

    try {
      await input.onProgress("uploading", 0.1);

      const buffer = await fs.readFile(outputPath);
      const storagePath = `exports/${exportJobId}.${EXTENSIONS[format]}`;
      const url = await objectStorage()
        .putBuffer(storagePath, buffer, CONTENT_TYPES[format])
        .catch((error) => {
          throw new RenderError(
            "STORAGE_FAILED",
            "Could not upload the rendered video",
            error instanceof Error ? error.message : String(error),
          );
        });

      await input.onProgress("uploading", 1);
      await input.onProgress("finalizing", 1);

      return { url, storagePath, size: buffer.byteLength };
    } finally {
      // Always clean up scratch space, success or failure (§32).
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /** Removes an output whose job was cancelled after it finished rendering. */
  static async discard(storagePath: string): Promise<void> {
    await objectStorage().delete(storagePath);
  }

  private static withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new RenderError("TIMEOUT", `Render exceeded the ${Math.round(ms / 1000)}s limit`)),
        ms,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
