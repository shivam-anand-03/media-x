"use client";

import * as React from "react";
import type { AssetKind } from "@workspace/motion";
import {
  useConfirmUploadMutation,
  useRequestUploadUrlMutation,
  type AssetRecord,
} from "../api/studio-api";

/**
 * Direct-to-storage uploads (§13, §35).
 *
 * Three steps per file: ask the API for a signed ticket, PUT the bytes straight
 * at storage (never through the API process), then confirm so the Asset row is
 * created. Progress comes from `XMLHttpRequest` because `fetch` still has no
 * upload-progress event.
 *
 * Failed uploads stay in the list with their original `File` so Retry is a real
 * retry rather than asking the user to pick the file again.
 */

export interface UploadItem {
  id: string;
  filename: string;
  progress: number;
  status: "preparing" | "uploading" | "confirming" | "done" | "error";
  error?: string;
  /** Kept so a failed upload can be retried without re-picking the file. */
  file: File;
  asset?: AssetRecord;
}

/** Maps a browser MIME type onto the API's asset kind. */
function kindFromFile(file: File): AssetKind | null {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "AUDIO";
  return null;
}

/**
 * Reads intrinsic dimensions (images/video) or duration (audio/video) in the
 * browser, so the editor can size a layer correctly on insert without the
 * server having to probe the file.
 */
async function probeMetadata(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({});
        img.src = url;
      });
    }
    if (file.type.startsWith("video/")) {
      return await new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () =>
          resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
        video.onerror = () => resolve({});
        video.src = url;
      });
    }
    if (file.type.startsWith("audio/")) {
      return await new Promise((resolve) => {
        const audio = document.createElement("audio");
        audio.preload = "metadata";
        audio.onloadedmetadata = () => resolve({ duration: audio.duration });
        audio.onerror = () => resolve({});
        audio.src = url;
      });
    }
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** PUTs a file to a signed URL, reporting progress. */
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    // The local driver authenticates via the ticket signature, but sending
    // cookies keeps same-origin deployments working too.
    xhr.withCredentials = url.startsWith(process.env.NEXT_PUBLIC_WEB_SERVER_URL ?? "");

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.send(file);
  });
}

export function useAssetUpload(projectId?: string) {
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  const [requestUploadUrl] = useRequestUploadUrlMutation();
  const [confirmUpload] = useConfirmUploadMutation();

  const patch = React.useCallback((id: string, next: Partial<UploadItem>) => {
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  const run = React.useCallback(
    async (item: UploadItem) => {
      const kind = kindFromFile(item.file);
      if (!kind) {
        patch(item.id, { status: "error", error: "Unsupported file type." });
        return;
      }

      try {
        patch(item.id, { status: "preparing", progress: 0, error: undefined });

        const [ticket, metadata] = await Promise.all([
          requestUploadUrl({
            kind,
            filename: item.file.name,
            mimeType: item.file.type,
            size: item.file.size,
            projectId,
          }).unwrap(),
          probeMetadata(item.file),
        ]);

        patch(item.id, { status: "uploading" });
        await putWithProgress(ticket.uploadUrl, item.file, ticket.headers, (progress) =>
          patch(item.id, { progress }),
        );

        patch(item.id, { status: "confirming", progress: 100 });
        const asset = await confirmUpload({
          storagePath: ticket.storagePath,
          kind,
          filename: item.file.name,
          mimeType: item.file.type,
          size: item.file.size,
          projectId,
          metadata,
        }).unwrap();

        patch(item.id, { status: "done", asset });

        // Clear finished rows shortly after so the panel doesn't accumulate
        // a growing list of completed uploads.
        setTimeout(() => {
          setUploads((current) => current.filter((u) => u.id !== item.id));
        }, 1200);
      } catch (error) {
        patch(item.id, { status: "error", error: describeUploadError(error) });
      }
    },
    [confirmUpload, patch, projectId, requestUploadUrl],
  );

  const upload = React.useCallback(
    async (files: File[]) => {
      const items: UploadItem[] = files.map((file) => ({
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
        filename: file.name,
        progress: 0,
        status: "preparing",
        file,
      }));

      setUploads((current) => [...current, ...items]);
      // Sequential: parallel uploads of several large videos starve each other
      // and make every progress bar crawl.
      for (const item of items) {
        await run(item);
      }
    },
    [run],
  );

  const retry = React.useCallback(
    (id: string) => {
      const item = uploads.find((u) => u.id === id);
      if (item) void run(item);
    },
    [run, uploads],
  );

  const dismiss = React.useCallback((id: string) => {
    setUploads((current) => current.filter((item) => item.id !== id));
  }, []);

  return { uploads, upload, retry, dismiss };
}

function describeUploadError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const err = error as { data?: { message?: string }; message?: string };
    if (err.data?.message) return err.data.message;
    if (err.message) return err.message;
  }
  return "Upload failed. Please try again.";
}
