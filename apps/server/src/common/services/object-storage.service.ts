import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { envs } from "@/common/configs/envs.config";
import { logger } from "@/common/helper/logger";
import { ValidationError } from "@/common/utils/error-utils";

/**
 * Object storage behind a driver interface.
 *
 * §35 requires that media never flows through the API process: the client asks
 * for an upload ticket, PUTs the bytes straight at storage, then confirms. Only
 * a local-disk driver is implemented — the interface is kept so a bucket-backed
 * driver can be added without touching any calling code.
 */

export interface UploadTicket {
  /** Where the client PUTs the bytes. */
  uploadUrl: string;
  /** Headers the client must send with the PUT. */
  headers: Record<string, string>;
  /** Storage key to send back on confirm. */
  storagePath: string;
  /** Where the finished object will be readable. */
  publicUrl: string;
  expiresAt: string;
}

export interface StorageDriver {
  readonly name: "local";
  createUploadTicket(input: {
    storagePath: string;
    mimeType: string;
    size: number;
  }): Promise<UploadTicket>;
  /** Confirms the object exists and returns its real size. */
  head(storagePath: string): Promise<{ exists: boolean; size: number }>;
  putBuffer(storagePath: string, buffer: Buffer, mimeType: string): Promise<string>;
  publicUrl(storagePath: string): string;
  delete(storagePath: string): Promise<void>;
  /**
   * A time-limited URL for reading one object.
   *
   * `filename` sets the download name; `disposition: "attachment"` makes the
   * browser save rather than stream it in a tab. The local driver serves from
   * /uploads and needs neither, but the shape is kept for a future driver.
   */
  signedReadUrl(
    storagePath: string,
    options?: { filename?: string; disposition?: "inline" | "attachment"; expiresInMinutes?: number },
  ): Promise<string>;
  /**
   * Checks the driver can actually write, so a misconfiguration surfaces at
   * boot rather than on a student's first upload.
   */
  verifyWritable(): Promise<{ ok: boolean; reason?: string }>;
}

// ---------------------------------------------------------------------------
// Upload policy — enforced before any ticket is issued (§44)
// ---------------------------------------------------------------------------

export const UPLOAD_LIMITS = {
  IMAGE: { maxSize: 15 * 1024 * 1024, mimes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/avif"] },
  LOGO: { maxSize: 5 * 1024 * 1024, mimes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
  VIDEO: { maxSize: 200 * 1024 * 1024, mimes: ["video/mp4", "video/webm", "video/quicktime"] },
  AUDIO: { maxSize: 30 * 1024 * 1024, mimes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac", "audio/mp4", "audio/webm"] },
} as const;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

/**
 * Validates a requested upload against its kind. Returning a typed error here
 * — before a ticket exists — means an oversized or wrong-typed file never
 * occupies a storage key at all.
 */
export function assertUploadAllowed(kind: UploadKind, mimeType: string, size: number): void {
  const policy = UPLOAD_LIMITS[kind];
  if (!policy) throw new ValidationError(`Unsupported upload type: ${kind}`);

  if (!(policy.mimes as readonly string[]).includes(mimeType)) {
    throw new ValidationError(
      `${mimeType} files are not supported here. Allowed: ${policy.mimes.join(", ")}`,
    );
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new ValidationError("File size is missing or invalid.");
  }
  if (size > policy.maxSize) {
    throw new ValidationError(
      `File is too large. The limit for ${kind.toLowerCase()} files is ${Math.round(policy.maxSize / (1024 * 1024))}MB.`,
    );
  }
}

/** Strips anything that could escape the intended prefix. */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name).toLowerCase();
  const cleaned = base
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[.-]+/, "");
  return cleaned.slice(0, 120) || "file";
}

/** Prefix every uploaded object shares. Confirm checks it, so a client cannot
 *  claim an arbitrary key such as an export or a path outside the media tree. */
export const MEDIA_PREFIX = "media";

export function buildStoragePath(kind: UploadKind, filename: string): string {
  const safe = sanitizeFilename(filename);
  const unique = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}`;
  return `${MEDIA_PREFIX}/${kind.toLowerCase()}/${unique}-${safe}`;
}

// ---------------------------------------------------------------------------
// Local driver
// ---------------------------------------------------------------------------

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

/** Refuses any key that would resolve outside the uploads root. */
function resolveLocalPath(storagePath: string): string {
  const target = path.resolve(UPLOAD_ROOT, storagePath);
  const root = path.resolve(UPLOAD_ROOT);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new ValidationError("Invalid storage path.");
  }
  return target;
}

/**
 * Signs a local upload ticket. Without this, `PUT /v1/assets/upload/<path>`
 * would be an open write endpoint; the HMAC binds the key, content type, size
 * and expiry so a ticket can only be used for the upload it was issued for.
 */
export function signLocalUpload(storagePath: string, mimeType: string, size: number, expiresAt: number): string {
  return crypto
    .createHmac("sha256", envs.UPLOAD_SIGNING_SECRET || "insecure-dev-secret")
    .update(`${storagePath}:${mimeType}:${size}:${expiresAt}`)
    .digest("hex");
}

export function verifyLocalUpload(
  storagePath: string,
  mimeType: string,
  size: number,
  expiresAt: number,
  signature: string,
): void {
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    throw new ValidationError("This upload link has expired. Please try uploading again.");
  }
  const expected = signLocalUpload(storagePath, mimeType, size, expiresAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ValidationError("Invalid upload signature.");
  }
}

class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  async createUploadTicket({ storagePath, mimeType, size }: { storagePath: string; mimeType: string; size: number }) {
    const expiresAt = Date.now() + envs.UPLOAD_URL_TTL_MINUTES * 60_000;
    const signature = signLocalUpload(storagePath, mimeType, size, expiresAt);
    const query = new URLSearchParams({
      path: storagePath,
      mimeType,
      size: String(size),
      expires: String(expiresAt),
      signature,
    });
    return {
      uploadUrl: `${envs.SERVER_APP_URL}/v1/assets/upload?${query.toString()}`,
      headers: { "Content-Type": mimeType },
      storagePath,
      publicUrl: this.publicUrl(storagePath),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async head(storagePath: string) {
    try {
      const stats = await fs.stat(resolveLocalPath(storagePath));
      return { exists: stats.isFile(), size: stats.size };
    } catch {
      return { exists: false, size: 0 };
    }
  }

  async putBuffer(storagePath: string, buffer: Buffer) {
    const target = resolveLocalPath(storagePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return this.publicUrl(storagePath);
  }

  publicUrl(storagePath: string): string {
    return `${envs.SERVER_APP_URL}/uploads/${storagePath}`;
  }

  async delete(storagePath: string) {
    await fs.unlink(resolveLocalPath(storagePath)).catch(() => {});
  }

  /**
   * The local driver has no signing: files are served straight from
   * `/uploads`. The download route streams the bytes itself in this mode, so
   * disposition is handled there rather than in the URL.
   */
  async signedReadUrl(storagePath: string) {
    return this.publicUrl(storagePath);
  }

  async verifyWritable() {
    try {
      await fs.mkdir(UPLOAD_ROOT, { recursive: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let driver: StorageDriver | null = null;

export function objectStorage(): StorageDriver {
  if (driver) return driver;

  driver = new LocalStorageDriver();
  logger.info(`🗄️  Object storage driver: ${driver.name}`);
  return driver;
}
