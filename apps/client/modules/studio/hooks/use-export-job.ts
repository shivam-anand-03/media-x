"use client";

import * as React from "react";
import { isActive, type ExportFormat, type ExportQuality } from "@workspace/motion";
import { useSocket } from "@/hooks/use-socket";
import {
  useCancelExportMutation,
  useCreateExportMutation,
  useGetExportQuery,
  useRetryExportMutation,
  type ExportJobResponse,
} from "../api/studio-api";

/**
 * Tracks one export job to completion.
 *
 * Progress arrives two ways on purpose: the socket pushes updates the moment
 * the worker emits them, and a poll runs as a fallback so a dropped websocket
 * (or a worker on another instance) can't leave the bar frozen. Polling stops
 * as soon as the job reaches a terminal state.
 */

const POLL_INTERVAL = 2500;

interface ExportProgressEvent {
  id: string;
  status: ExportJobResponse["status"];
  progress: number;
  stage?: ExportJobResponse["stage"];
  outputUrl?: string;
  fileSize?: number;
  errorCode?: string;
}

export function useExportJob(projectId: string | null) {
  const { socket } = useSocket();

  const [jobId, setJobId] = React.useState<string | null>(null);
  const [live, setLive] = React.useState<ExportJobResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [createExport, { isLoading: starting }] = useCreateExportMutation();
  const [retryExport] = useRetryExportMutation();
  const [cancelExport] = useCancelExportMutation();

  // Poll while the job is running; stop once it settles.
  const { data: polled } = useGetExportQuery(jobId ?? "", {
    skip: !jobId,
    pollingInterval: live && !isActive(live.status) ? 0 : POLL_INTERVAL,
  });

  // The socket is usually ahead of the poll, so prefer whichever reports more
  // progress — this stops the bar visibly jumping backwards.
  const job = React.useMemo(() => {
    if (!live) return polled ?? null;
    if (!polled) return live;
    if (!isActive(polled.status)) return polled;
    if (!isActive(live.status)) return live;
    return polled.progress > live.progress ? polled : live;
  }, [live, polled]);

  React.useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (payload: ExportProgressEvent) => {
      if (payload.id !== jobId) return;
      setLive((current) => ({
        ...(current ?? ({} as ExportJobResponse)),
        ...payload,
        id: payload.id,
        error: payload.errorCode ?? current?.error ?? null,
      }));
    };

    socket.on("EXPORT_PROGRESS", onProgress);
    return () => {
      socket.off("EXPORT_PROGRESS", onProgress);
    };
  }, [socket, jobId]);

  const start = React.useCallback(
    async (options: { format: ExportFormat; quality: ExportQuality }) => {
      if (!projectId) return;
      setError(null);
      try {
        const created = await createExport({ projectId, ...options }).unwrap();
        setJobId(created.id);
        setLive(created);
      } catch (err) {
        setError(extractMessage(err));
      }
    },
    [createExport, projectId],
  );

  const retry = React.useCallback(async () => {
    if (!jobId) return;
    setError(null);
    try {
      // Retry creates a new job, so follow the new id from here on.
      const next = await retryExport(jobId).unwrap();
      setJobId(next.id);
      setLive(next);
    } catch (err) {
      setError(extractMessage(err));
    }
  }, [jobId, retryExport]);

  const cancel = React.useCallback(async () => {
    if (!jobId) return;
    try {
      const next = await cancelExport(jobId).unwrap();
      setLive(next);
    } catch (err) {
      setError(extractMessage(err));
    }
  }, [jobId, cancelExport]);

  const reset = React.useCallback(() => {
    setJobId(null);
    setLive(null);
    setError(null);
  }, []);

  return { job, start, retry, cancel, reset, starting, error };
}

function extractMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const err = error as { data?: { message?: string } };
    if (err.data?.message) return err.data.message;
  }
  return "We couldn't start the export. Please try again.";
}
