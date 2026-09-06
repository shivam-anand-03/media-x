import * as React from "react";
import { cn } from "@workspace/ui/lib/utils";

export interface PageLoaderProps {
  /**
   * The brand mark shown at the centre of the loader. Apps pass their own
   * optimized image element here (e.g. a `next/image`) so this component stays
   * framework-agnostic.
   */
  logo?: React.ReactNode;
  /** Primary heading. Defaults to the product name. */
  title?: string;
  /** Small caption under the heading. */
  subtitle?: string;
  /**
   * When true (default) the loader covers the whole viewport (`fixed inset-0`).
   * Set to false to fill the nearest positioned/relative parent instead — handy
   * as a `<Suspense>` fallback inside a card or panel.
   */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Full-screen, theme-aware page loader. Colours come entirely from the shared
 * brand tokens in `globals.css`, so it adapts to light/dark and to each app's
 * brand automatically.
 */
export function PageLoader({
  logo,
  title = "Upgence",
  subtitle = "Setting up workspace",
  fullScreen = true,
  className,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center overflow-hidden bg-background transition-colors duration-500",
        fullScreen ? "fixed inset-0 z-50" : "absolute inset-0 min-h-60",
        className,
      )}
    >
      <style>{`
        @keyframes upg-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.1); opacity: 0.5; }
        }
        @keyframes upg-orbit {
          0% { transform: rotate(0deg) translateX(48px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(48px) rotate(-360deg); }
        }
        @keyframes upg-pulse-logo {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px color-mix(in oklab, var(--brand-bright) 35%, transparent)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 25px color-mix(in oklab, var(--brand-pink) 60%, transparent)); }
        }
        @keyframes upg-progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        .upg-ring { animation: upg-pulse-ring 4s infinite ease-in-out; }
        .upg-orbit { animation: upg-orbit 3.5s infinite linear; }
        .upg-logo { animation: upg-pulse-logo 2.5s infinite ease-in-out; }
        .upg-progress { animation: upg-progress 2s infinite linear; }
        @media (prefers-reduced-motion: reduce) {
          .upg-ring, .upg-orbit, .upg-logo, .upg-progress { animation: none; }
        }
      `}</style>

      {/* Ambient glowing backdrop blobs */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-brand-bright/10 blur-[100px] animate-float-slow" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[50vw] w-[50vw] rounded-full bg-brand-pink/10 blur-[100px] animate-float-reverse" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4 text-center">
        {/* Logo stage */}
        <div className="relative flex h-40 w-40 items-center justify-center">
          {/* Layered pulsing rings */}
          <div className="upg-ring absolute inset-0 rounded-full border border-brand-bright/20" />
          <div
            className="upg-ring absolute inset-4 rounded-full border border-brand-pink/20"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="upg-ring absolute inset-8 rounded-full border border-brand-soft/20"
            style={{ animationDelay: "2s" }}
          />

          {/* Orbiting spark */}
          <div className="upg-orbit absolute flex items-center justify-center">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-pink opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-linear-to-r from-brand-pink to-brand-bright shadow-md shadow-brand-pink/50" />
            </span>
          </div>

          {/* Central logo container */}
          <div className="upg-logo relative flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-card shadow-2xl">
            {logo}
          </div>
        </div>

        {/* Text and branding */}
        <div className="mx-auto max-w-xs space-y-4">
          <div className="space-y-1.5">
            <h1 className="bg-linear-to-r from-brand-bright via-brand-pink to-brand-dark bg-clip-text text-2xl font-black tracking-tight text-transparent">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                {subtitle}
              </p>
            ) : null}
          </div>

          {/* Loading progress bar */}
          <div className="relative mx-auto h-1 w-32 overflow-hidden rounded-full bg-muted">
            <div className="upg-progress absolute inset-0 h-full w-full rounded-full bg-linear-to-r from-brand-bright via-brand-pink to-brand-dark" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default PageLoader;
