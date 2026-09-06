"use client";

import * as React from "react";

/**
 * Reads design tokens as concrete colour strings, for canvases that cannot use
 * CSS variables.
 *
 * Konva paints to a `<canvas>`, so `var(--primary)` means nothing to it — the
 * selection handles and alignment guides would have to hardcode a hex value and
 * would then drift the moment the theme changes. This resolves the tokens from
 * the document once, and again whenever the light/dark class flips.
 */
export interface CanvasThemeColors {
  /** Selection box and transform handles. */
  accent: string;
  /** Centre alignment guides. */
  guideCenter: string;
  /** Edge and object alignment guides. */
  guideEdge: string;
  /** Handle fill — reads as "grab me" against the artwork. */
  handleFill: string;
  /** Safe-area rectangle. */
  safeArea: string;
}

const FALLBACK: CanvasThemeColors = {
  accent: "#d4af37",
  guideCenter: "#e8b923",
  guideEdge: "#c98b3a",
  handleFill: "#ffffff",
  safeArea: "#c98b3a",
};

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

export function useCanvasThemeColors(): CanvasThemeColors {
  const [colors, setColors] = React.useState<CanvasThemeColors>(FALLBACK);

  React.useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      setColors({
        accent: readToken(styles, "--primary", FALLBACK.accent),
        guideCenter: readToken(styles, "--brand-bright", FALLBACK.guideCenter),
        guideEdge: readToken(styles, "--brand-pink", FALLBACK.guideEdge),
        handleFill: readToken(styles, "--card", FALLBACK.handleFill),
        safeArea: readToken(styles, "--info", FALLBACK.safeArea),
      });
    };

    read();

    // next-themes toggles a class on <html>; re-read so canvas chrome tracks it.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
