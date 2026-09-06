import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Film, Layers, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { BrandLogo } from "@/components/global/brand-logo";
import { ThemeToggle } from "@/components/global/theme-toggle";

export const metadata: Metadata = {
  title: "Motion Studio — Advertisement Editor",
  description:
    "Design, animate and export professional short-form advertisements. Canvas, timeline, animation and MP4 rendering in one workspace.",
};

/**
 * The signed-out landing page.
 *
 * Authenticated visitors never see it — middleware redirects `/` to the
 * workspace. It exists to explain the product and route to sign-in.
 */
export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Ambient backdrop, drawn from theme tokens. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px)] bg-size-[32px_32px] mask-[radial-gradient(ellipse_70%_60%_at_50%_35%,#000_55%,transparent_100%)]" />
        <div className="animate-float-slow absolute -top-[15%] -left-[8%] size-[34rem] rounded-full bg-primary/16 blur-[140px]" />
        <div className="animate-float-medium absolute -right-[8%] bottom-[5%] size-[30rem] rounded-full bg-brand-pink/14 blur-[130px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <BrandLogo href="/" />
        <div className="flex items-center gap-2">
          <ThemeToggle className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur-sm">
          <Sparkles className="size-3 text-primary" />
          Motion graphics for students
        </span>

        <h1 className="max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight text-balance text-foreground sm:text-6xl">
          Make advertisements that <span className="text-primary">actually move</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
          A real editor for short-form video ads — professional canvas, keyframe-free animation, a
          working timeline, and server-side MP4 rendering. Built for campus events, product launches
          and campaigns.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="gap-1.5" asChild>
            <Link href="/sign-up">
              Start creating
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">I already have an account</Link>
          </Button>
        </div>

        <ul className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-xl border border-border/70 bg-card/70 p-4 backdrop-blur-sm"
            >
              <span className="mb-2.5 grid size-8 place-items-center rounded-lg bg-primary/12 text-primary">
                <Icon className="size-4" />
              </span>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-5">
        <p className="text-center text-[11px] text-muted-foreground">
          Motion Studio · Built with Next.js, Konva and Remotion
        </p>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: Layers,
    title: "Real canvas and layers",
    body: "Drag, resize, rotate and arrange with snapping, alignment guides and a live layer stack.",
  },
  {
    icon: Film,
    title: "A timeline that works",
    body: "Every clip's position drives when it appears. Drag to move, pull an edge to retime.",
  },
  {
    icon: Wand2,
    title: "Export to MP4",
    body: "Rendering runs on the server with Remotion and FFmpeg, so long exports never block you.",
  },
] as const;
