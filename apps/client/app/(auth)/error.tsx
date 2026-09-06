"use client";

import { useEffect } from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Surface the error for logging/monitoring
    console.error(error);
  }, [error]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background px-4 overflow-hidden">
      {/* Ambient brand blobs — adapt automatically via brand tokens */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-brand-soft/30 blur-3xl animate-float-slow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-brand-bright/20 blur-3xl animate-float-medium"
      />

      <Card className="relative w-full max-w-md border-border bg-card shadow-lg shadow-brand-dark/10">
        <CardContent className="pt-10 pb-10 px-8 text-center">
          {/* Icon in a soft brand ring */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 ring-8 ring-destructive/5">
            <AlertTriangle className="h-9 w-9 text-destructive" />
          </div>

          <h2 className="text-xl font-semibold text-card-foreground mb-2">
            Something went wrong
          </h2>

          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            The page hit an unexpected error. You can retry the action, or head
            back to the dashboard.
          </p>

          {/* Digest shown only when present — useful for support tickets */}
          {error.digest && (
            <p className="mb-6 inline-block rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button onClick={() => router.push("/")} className="gap-2">
              <Home className="h-4 w-4" />
              Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
