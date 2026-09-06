"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { BorderBeam } from "@workspace/ui/components/magicui/border-beam";
import { MagicCard } from "@workspace/ui/components/magicui/magic-card";

type SurfaceTone = "card" | "muted" | "brand";

const toneClass: Record<SurfaceTone, string> = {
  // Plain elevated surface — the default for content panels.
  card: "bg-card",
  // A step back from `card`; used for grouping panels that hold other cards.
  muted: "bg-muted/40",
  // Brand-tinted wash for hero/feature surfaces.
  brand:
    "bg-linear-to-br from-primary/8 via-card to-brand-pink/5 dark:from-primary/12 dark:via-card dark:to-brand-pink/8",
};

interface SurfaceProps extends React.ComponentProps<"div"> {
  tone?: SurfaceTone;
  /** Run a light around the border — reserve it for the one hero element per view. */
  beam?: boolean;
  /** Light the border and surface under the cursor. */
  interactive?: boolean;
  /** Lift slightly on hover. Implies a pointer affordance. */
  hoverLift?: boolean;
  /** Corner rounding. `lg` is the app default for panels. */
  radius?: "md" | "lg" | "xl";
}

const radiusClass = {
  md: "rounded-2xl",
  lg: "rounded-3xl",
  xl: "rounded-4xl",
} as const;

/**
 * The single elevated surface used across the app.
 *
 * Every panel, card and form section is a `Surface` so borders, radii, shadow
 * depth and hover behaviour stay identical everywhere. Colours come from theme
 * tokens only, so light and dark are both handled without per-call overrides.
 */
export function Surface({
  className,
  tone = "card",
  beam = false,
  interactive = false,
  hoverLift = false,
  radius = "lg",
  children,
  ...props
}: SurfaceProps) {
  const shell = cn(
    "relative isolate border border-border/70",
    radiusClass[radius],
    toneClass[tone],
    "shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_4%,transparent),0_12px_32px_-16px_color-mix(in_oklab,var(--foreground)_10%,transparent)]",
    hoverLift &&
      "transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_2px_4px_color-mix(in_oklab,var(--foreground)_5%,transparent),0_20px_44px_-20px_color-mix(in_oklab,var(--primary)_35%,transparent)]",
    className,
  );

  if (interactive) {
    return (
      <MagicCard className={shell} {...props}>
        {beam && <BorderBeam duration={9} size={70} />}
        {children}
      </MagicCard>
    );
  }

  return (
    <div className={shell} {...props}>
      {beam && <BorderBeam duration={9} size={70} />}
      {children}
    </div>
  );
}

export default Surface;
