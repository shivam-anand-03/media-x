"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background px-4 overflow-hidden">
      {/* Ambient brand blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 -right-24 h-80 w-80 rounded-full bg-brand-pink/20 blur-3xl animate-float-reverse"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-bright/20 blur-3xl animate-float-slow"
      />

      <div className="relative text-center max-w-lg">
        {/* Oversized 404 as the visual anchor, tinted with the brand gradient */}
        <p
          aria-hidden
          className="select-none text-[9rem] sm:text-[11rem] font-bold leading-none tracking-tighter bg-linear-to-b from-brand-bright to-brand-dark bg-clip-text text-transparent"
        >
          404
        </p>

        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>

        <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. Check the URL, or use the options below to get back on track.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </Button>
        </div>

        {/* Subtle footer hint */}
        <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
          <Search className="h-3.5 w-3.5" />
          If you typed the address, double-check the spelling.
        </p>
      </div>
    </div>
  );
}
