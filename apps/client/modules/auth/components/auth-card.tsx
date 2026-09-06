import React from "react";
import { Clapperboard, Layers, Music4, Sparkles, Type } from "lucide-react";

/**
 * The auth split panel.
 *
 * The right-hand side illustrates what the product actually does — a scene
 * strip and a miniature timeline — rather than quoting invented usage numbers.
 * Everything is drawn from theme tokens so it stays coherent in both themes.
 */

const SCENES = [
  { label: "Logo & headline", start: 0, span: 2, tone: "bg-primary" },
  { label: "Event details", start: 2, span: 3, tone: "bg-brand-pink" },
  { label: "Competition", start: 5, span: 3, tone: "bg-info" },
  { label: "Call to action", start: 8, span: 2, tone: "bg-warning" },
] as const;

const TRACKS = [
  { icon: Type, label: "Headline", start: 0, span: 4 },
  { icon: Layers, label: "Product", start: 2, span: 5 },
  { icon: Sparkles, label: "CTA", start: 7, span: 3 },
  { icon: Music4, label: "Music", start: 0, span: 10 },
] as const;

const AuthCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={className}>
      {children}

      <aside className="relative m-2 hidden min-h-145 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-[oklch(0.16_0.012_306)] p-9 text-white lg:flex">
        {/* Brand-tinted blooms + blueprint grid. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_38%,transparent),transparent_62%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,color-mix(in_oklab,var(--brand-pink)_26%,transparent),transparent_55%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-size-[26px_26px]"
        />

        <header className="relative z-10 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-white/15 bg-white/10 shadow-inner backdrop-blur-md">
            <Clapperboard className="size-4.5 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-xs font-bold tracking-[0.16em] text-white/90 uppercase">
              Motion Studio
            </span>
            <span className="block text-[10px] text-white/45">
              Short-form advertisement editor
            </span>
          </span>
        </header>

        <div className="relative z-10 my-auto w-full py-10">
          <p className="mb-5 text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">
            Storyboard
          </p>

          {/* Scene strip — the four beats of a ten-second advertisement. */}
          <div className="grid grid-cols-10 gap-1.5">
            {SCENES.map((scene) => (
              <div
                key={scene.label}
                className="group/scene relative"
                style={{ gridColumn: `span ${scene.span} / span ${scene.span}` }}
              >
                <div
                  className={`h-16 rounded-lg ${scene.tone} opacity-85 ring-1 ring-white/10 transition-opacity duration-300 group-hover/scene:opacity-100`}
                />
                <p className="mt-1.5 truncate text-[10px] font-medium text-white/55">
                  {scene.label}
                </p>
              </div>
            ))}
          </div>

          {/* Miniature timeline — the same four-track shape as the editor. */}
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-[10px] text-white/40">
              <span className="font-semibold tracking-[0.12em] uppercase">Timeline</span>
              <span className="tabular-nums">0:10 · 1080 × 1920 · 30 fps</span>
            </div>

            <div className="space-y-2">
              {TRACKS.map(({ icon: Icon, label, start, span }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="flex w-20 shrink-0 items-center gap-1.5 text-[10px] text-white/50">
                    <Icon className="size-3 shrink-0" />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="grid flex-1 grid-cols-10 gap-px">
                    <span
                      className="h-2.5 rounded-full bg-linear-to-r from-primary/80 to-brand-pink/70"
                      style={{ gridColumn: `${start + 1} / span ${span}` }}
                    />
                  </span>
                </div>
              ))}
            </div>

            {/* Playhead marker. */}
            <div className="relative mt-3 h-px w-full bg-white/10">
              <span className="absolute -top-1 left-[42%] size-2 rounded-full bg-white shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_45%,transparent)]" />
            </div>
          </div>
        </div>

        <footer className="relative z-10 mt-auto border-t border-white/10 pt-6">
          <p className="text-sm leading-relaxed font-light text-white/70">
            Design, animate and export professional short-form advertisements — canvas,
            timeline, animation and MP4 rendering in one workspace.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Canvas", "Timeline", "Animation", "MP4 Export"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/60"
              >
                {tag}
              </span>
            ))}
          </div>
        </footer>
      </aside>
    </div>
  );
};

export default AuthCard;
