import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { Types } from "mongoose";
import type { GenerateAdvertisementInput } from "@workspace/motion";
import { AssetModel, AssetStatus, AssetType } from "@/core/models";
import { objectStorage } from "@/common/services/object-storage.service";
import { ValidationError } from "@/common/utils/error-utils";
import { logger } from "@/common/helper/logger";

/**
 * Media the user attached to an AI generation.
 *
 * Assets are referenced by id and resolved here, never by a client-supplied
 * URL, so a request can only use media that was uploaded through the normal
 * policy-checked flow.
 */

export interface GenerationBackground {
  kind: "image" | "video";
  url: string;
  filename: string;
  width?: number;
  height?: number;
  /** Seconds — videos only. */
  duration?: number;
  /** Small JPEG data URLs for the vision model: one for an image, a few frames for a video. */
  visionDataUrls: string[];
  /** Average brightness 0–1, used to decide how strong the text overlay is. */
  luminance: number;
  /** Dominant colours, most prominent first. */
  colors: string[];
}

export interface GenerationAudio {
  url: string;
  filename: string;
  /** Seconds, when the browser could probe it. */
  duration?: number;
}

export interface GenerationMedia {
  background?: GenerationBackground;
  audio?: GenerationAudio;
}

export async function resolveGenerationMedia(input: GenerateAdvertisementInput): Promise<GenerationMedia> {
  const [background, audio] = await Promise.all([
    input.backgroundAssetId ? resolveBackground(input.backgroundAssetId) : undefined,
    input.audioAssetId ? resolveAudio(input.audioAssetId) : undefined,
  ]);
  return { background, audio };
}

async function loadAsset(id: string, types: AssetType[], label: string) {
  if (!Types.ObjectId.isValid(id)) throw new ValidationError(`The ${label} is not valid.`);
  const asset = await AssetModel.findById(id).lean();
  if (!asset || !types.includes(asset.type) || asset.status === AssetStatus.FAILED) {
    throw new ValidationError(`The ${label} could not be found. Please upload it again.`);
  }
  return asset;
}

async function resolveBackground(id: string): Promise<GenerationBackground> {
  const asset = await loadAsset(id, [AssetType.IMAGE, AssetType.LOGO, AssetType.VIDEO], "background image or video");
  const storage = objectStorage();
  const kind = asset.type === AssetType.VIDEO ? "video" : "image";
  const base: GenerationBackground = {
    kind,
    url: storage.publicUrl(asset.storagePath),
    filename: asset.filename,
    width: asset.metadata?.width,
    height: asset.metadata?.height,
    duration: finite(asset.metadata?.duration),
    visionDataUrls: [],
    luminance: 0.5,
    colors: [],
  };

  try {
    if (kind === "image") {
      const analysis = await analyseImage(await storage.read(asset.storagePath));
      base.visionDataUrls = [analysis.visionDataUrl];
      base.luminance = analysis.luminance;
      base.colors = analysis.colors;
      base.width ??= analysis.width;
      base.height ??= analysis.height;
    } else {
      const file = storage.localPath(asset.storagePath);
      if (!file) throw new Error("Storage driver has no local path for ffmpeg");
      if (!base.duration || !base.width || !base.height) {
        const { getVideoMetadata } = await import("@remotion/renderer");
        const meta = await getVideoMetadata(file, { logLevel: "error" });
        base.duration ??= finite(meta.durationInSeconds ?? undefined);
        base.width ??= meta.width;
        base.height ??= meta.height;
      }
      const frames = await extractVideoFrames(file, base.duration);
      const analyses = await Promise.all(frames.map((frame) => analyseImage(frame)));
      base.visionDataUrls = analyses.map((a) => a.visionDataUrl);
      // Overlay strength follows the brightest frame so text stays readable
      // throughout; colours come from the middle frame, the most representative.
      const middle = analyses[Math.floor(analyses.length / 2)];
      if (middle) {
        base.luminance = Math.max(...analyses.map((a) => a.luminance));
        base.colors = middle.colors;
      }
    }
  } catch (error) {
    // The media still works as a background; only the AI's view of it is lost.
    logger.warn("Could not analyse the background media", {
      assetId: id,
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return base;
}

/**
 * Grabs three frames (start, middle, end) so the model sees how the clip
 * develops, using the ffmpeg that ships with Remotion — no system install.
 */
export async function extractVideoFrames(file: string, duration?: number): Promise<Buffer[]> {
  const { RenderInternals } = await import("@remotion/renderer");
  const length = duration && duration > 0 ? duration : 1;
  const times = [0.12, 0.5, 0.88].map((t) => Math.max(0, Math.min(length - 0.05, length * t)));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-frames-"));

  try {
    const frames: Buffer[] = [];
    for (const [i, time] of times.entries()) {
      const out = path.join(dir, `frame-${i}.jpg`);
      try {
        await RenderInternals.callFf({
          bin: "ffmpeg",
          args: ["-y", "-ss", time.toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=768:768:force_original_aspect_ratio=decrease", "-q:v", "4", out],
          indent: false,
          logLevel: "error",
          binariesDirectory: null,
          cancelSignal: undefined,
        });
        frames.push(await fs.readFile(out));
      } catch {
        // A seek past a short clip's last keyframe can fail; keep the others.
      }
    }
    if (!frames.length) throw new Error("ffmpeg produced no frames");
    return frames;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * What the generator needs to know about an image: a small preview for the
 * vision model, its brightness, and its dominant and most vivid colours.
 */
export async function analyseImage(bytes: Buffer): Promise<{
  visionDataUrl: string;
  luminance: number;
  colors: string[];
  width?: number;
  height?: number;
}> {
  const sharp = (await import("sharp")).default;
  const image = sharp(bytes, { animated: false }).rotate();

  // 768px on the long side with "low" detail is plenty for the model to
  // understand the scene, and keeps the request small and cheap.
  const preview = await image.clone().resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  const { dominant, channels } = await image.clone().resize(64, 64, { fit: "inside" }).removeAlpha().stats();
  const [r, g, b] = channels.map((c) => c.mean / 255) as [number, number, number];
  const meta = await image.metadata();

  return {
    visionDataUrl: `data:image/jpeg;base64,${preview.toString("base64")}`,
    luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b,
    colors: [toHex(dominant.r, dominant.g, dominant.b), ...(await vividColors(sharp, preview))],
    width: meta.width,
    height: meta.height,
  };
}

/** The most saturated colours in a tiny downsample, as accent candidates. */
async function vividColors(sharp: typeof import("sharp"), bytes: Buffer): Promise<string[]> {
  const { data, info } = await sharp(bytes).resize(12, 12, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels: { hex: string; score: number }[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const value = max / 255;
    pixels.push({ hex: toHex(r, g, b), score: saturation * (0.4 + value) });
  }
  return pixels
    .sort((a, b) => b.score - a.score)
    .filter((p) => p.score > 0.25)
    .map((p) => p.hex)
    .slice(0, 3);
}

async function resolveAudio(id: string): Promise<GenerationAudio> {
  const asset = await loadAsset(id, [AssetType.AUDIO], "audio file");
  return {
    url: objectStorage().publicUrl(asset.storagePath),
    filename: asset.filename,
    duration: finite(asset.metadata?.duration),
  };
}

const finite = (value: number | undefined) => (value && Number.isFinite(value) && value > 0 ? value : undefined);

const toHex = (r: number, g: number, b: number) =>
  `#${((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, "0")}`;
