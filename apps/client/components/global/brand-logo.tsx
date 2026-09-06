import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Clapperboard } from "lucide-react";

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
  /** Where the wordmark links. Defaults to the workspace. */
  href?: string;
  size?: "sm" | "md";
}

/**
 * The Motion Studio wordmark.
 *
 * Colours come from theme tokens only, so the same component sits correctly on
 * the light auth screens and on the dark editor chrome without overrides.
 */
export function BrandLogo({
  className,
  showText = true,
  href = "/dashboard",
  size = "md",
}: BrandLogoProps) {
  const markSize = size === "sm" ? "size-7" : "size-8";
  const iconSize = size === "sm" ? "size-4" : "size-4.5";

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-lg bg-primary text-primary-foreground",
          "shadow-sm shadow-primary/25 transition-transform duration-300 group-hover:scale-105",
          markSize,
        )}
      >
        <Clapperboard className={iconSize} />
      </span>

      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-base font-extrabold tracking-tight text-foreground">
            Motion<span className="text-primary">Studio</span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Advertisement Editor
          </span>
        </span>
      )}
    </Link>
  );
}
