/**
 * Server-side text measurement for generated layouts.
 *
 * There is no browser here, so widths are estimated from per-glyph averages.
 * The estimates are deliberately on the wide side — they are calibrated
 * against DejaVu Sans, the fallback a headless render uses when Inter is not
 * installed — and every box the compiler emits is wider than the text it was
 * wrapped to. The compiler also inserts explicit line breaks, so the renderer
 * never has to decide where a line wraps: what is measured here is what is
 * drawn, in the editor, the preview and the export.
 */

export interface TextMetrics {
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  uppercase?: boolean;
}

const NARROW = new Set("il.,:;'!|`".split(""));
const SEMI_NARROW = new Set("fjtrI()[]{}-/\"".split(""));
const WIDE = new Set("mwMW@%".split(""));

/** Approximate advance width of one glyph, in ems, at regular weight. */
function glyphEm(ch: string): number {
  if (ch === " ") return 0.32;
  if (NARROW.has(ch)) return 0.32;
  if (SEMI_NARROW.has(ch)) return 0.42;
  if (WIDE.has(ch)) return 0.98;
  if (ch >= "A" && ch <= "Z") return 0.74;
  if (ch >= "0" && ch <= "9") return 0.64;
  if (ch >= "a" && ch <= "z") return 0.6;
  const code = ch.codePointAt(0) ?? 0;
  // CJK, Hangul and full-width forms are roughly square.
  if ((code >= 0x2e80 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7af) || (code >= 0xff00 && code <= 0xffef)) {
    return 1.0;
  }
  // Accented Latin, Devanagari, emoji, symbols: assume a generous average.
  return 0.78;
}

/** Bolder weights are wider; 800 is ~10% wider than 400. */
const weightFactor = (weight: number) => 1 + (Math.max(0, weight - 400) / 400) * 0.1;

export function measureLine(text: string, m: TextMetrics): number {
  const value = m.uppercase ? text.toUpperCase() : text;
  let em = 0;
  let count = 0;
  for (const ch of value) {
    em += glyphEm(ch);
    count++;
  }
  return em * m.fontSize * weightFactor(m.fontWeight) + Math.max(0, count - 1) * m.letterSpacing;
}

/**
 * Greedy word wrap. A word wider than `maxWidth` on its own is broken by
 * character, and `overflowed` reports it so the caller can shrink the type
 * instead of accepting a mid-word break.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  m: TextMetrics,
): { lines: string[]; overflowed: boolean } {
  const lines: string[] = [];
  let overflowed = false;

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureLine(candidate, m) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measureLine(word, m) <= maxWidth) {
        line = word;
        continue;
      }
      overflowed = true;
      let chunk = "";
      for (const ch of word) {
        if (chunk && measureLine(chunk + ch, m) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }

  return { lines: lines.length ? lines : [""], overflowed };
}

/**
 * Wraps, then narrows the measure as far as possible without adding a line,
 * so a two-line headline splits into two even lines rather than one long
 * line and an orphaned word.
 */
export function wrapBalanced(
  text: string,
  maxWidth: number,
  m: TextMetrics,
): { lines: string[]; overflowed: boolean; width: number } {
  const first = wrapText(text, maxWidth, m);
  const widthOf = (lines: string[]) => lines.reduce((w, l) => Math.max(w, measureLine(l, m)), 0);
  if (first.lines.length < 2 || first.overflowed) {
    return { ...first, width: widthOf(first.lines) };
  }

  let lo = maxWidth * 0.4;
  let hi = maxWidth;
  let best = first.lines;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const attempt = wrapText(text, mid, m);
    if (!attempt.overflowed && attempt.lines.length === first.lines.length) {
      best = attempt.lines;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return { lines: best, overflowed: false, width: widthOf(best) };
}
