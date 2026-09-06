import React from "react";
import { ThemeToggle } from "@/components/global/theme-toggle";
import { BrandLogo } from "@/components/global/brand-logo";

/**
 * Auth shell.
 *
 * Every colour here is a theme token, so the screen tracks light/dark with the
 * rest of the app instead of pinning its own slate/purple palette.
 */
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-4 text-foreground transition-colors duration-500 sm:px-6 lg:px-8">
      {/* Ambient backdrop: a fine blueprint grid plus three brand-tinted blooms. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px)] bg-size-[28px_28px] mask-[radial-gradient(ellipse_65%_55%_at_50%_45%,#000_60%,transparent_100%)]" />
        <div className="animate-float-slow absolute -top-[10%] -left-[10%] size-[32rem] rounded-full bg-primary/15 blur-[130px]" />
        <div className="animate-float-medium absolute -right-[10%] -bottom-[12%] size-[36rem] rounded-full bg-brand-pink/12 blur-[140px]" />
        <div className="animate-float-reverse absolute top-[28%] right-[18%] size-[24rem] rounded-full bg-info/10 blur-[120px]" />
      </div>

      <div className="pointer-events-none absolute inset-x-6 top-6 z-50 flex items-center justify-between">
        <BrandLogo href="/" className="pointer-events-auto" size="sm" />

        <div className="pointer-events-auto flex items-center rounded-full border border-border/70 bg-card/70 p-1 shadow-sm backdrop-blur-md">
          <ThemeToggle className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
        </div>
      </div>

      <div className="relative z-10 flex w-full items-center justify-center pt-28 pb-12 sm:py-20">
        {children}
      </div>
    </main>
  );
};

export default Layout;
