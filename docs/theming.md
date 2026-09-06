# Theming

[← Back to README](../README.md)

Source: [`packages/ui/src/styles/globals.css`](../packages/ui/src/styles/globals.css)

---

## How it works

Every colour in the app is a CSS custom property defined in two blocks — `:root` for
light and `.dark` for dark. Components only ever reference tokens
(`bg-primary`, `text-muted-foreground`, `border-border`), never raw values.

That is what makes a retheme a two-block edit rather than a search-and-replace across
a hundred files.

---

## The golden theme

**Dark** — warm near-black surfaces. Every neutral carries hue ≈ 80 at low chroma, so
they read as one family rather than grey-plus-gold. Elevation is a single lightness
ladder:

```
background < sidebar < card = popover < muted < secondary < input < accent
```

Cards and popovers share a value, so a dropdown over a card never shifts colour.

**Light** — warm paper ground with a deeper antique gold.

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.985 0.006 90)` | `oklch(0.15 0.008 80)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.2 0.012 80)` |
| `--primary` | `oklch(0.56 0.115 80)` · `#976b03` | `oklch(0.8 0.14 88)` · `#e3b842` |
| `--primary-foreground` | near-white | dark ink |
| `--brand-bright` | bright gold, decorative | bright gold |
| `--brand-pink` | rose gold | rose gold |

---

## Why primary differs between modes

Gold is a **light** hue, which breaks the usual "brand colour + white text" pattern.
Measured, not eyeballed:

| Pairing | Ratio | |
|---|---|---|
| Bright gold + white label | **2.24** | ✗ unreadable |
| Bright gold as text on white | **2.24** | ✗ unreadable |

So the treatment splits:

- **Dark mode** keeps bright gold and puts **dark ink** on buttons → 10.19:1. Gold as
  text on a dark card → 9.64:1.
- **Light mode** uses a deeper gold that clears AA both as a button with a white
  label (4.59:1) *and* as text on white (4.72:1) — which matters because
  `text-primary` is used for links, active nav and labels throughout.

The bright decorative gold still exists as `--brand-bright` for gradients and glows,
where contrast rules do not apply.

### Verified

| Pairing | Ratio | |
|---|---|---|
| Light button (gold bg / white label) | 4.59 | AA |
| Light link text (gold on card) | 4.72 | AA |
| Light body text | 18.60 | AAA |
| Light muted text | 6.83 | AA |
| Dark button (gold bg / ink label) | 10.19 | AAA |
| Dark link text (gold on card) | 9.64 | AAA |
| Dark body text | 17.52 | AAA |
| Dark muted text | 7.30 | AAA |

All eight pass AA; most reach AAA.

---

## Token groups

| Group | Tokens |
|---|---|
| Surfaces | `background`, `card`, `popover`, `muted`, `secondary`, `accent` |
| Text | `foreground`, `*-foreground`, `muted-foreground` |
| Brand | `primary`, `brand-bright`, `brand-dark`, `brand-soft`, `brand-surface`, `brand-pink` |
| Semantic | `destructive`, `success`, `warning`, `info` |
| Structure | `border`, `input`, `ring`, `radius` |
| Charts | `chart-1` … `chart-5` |
| Sidebar | `sidebar`, `sidebar-primary`, `sidebar-accent`, … |

`--warning` is pushed toward orange (hue 55–62) so it stays distinguishable from the
gold brand colour — a warning that looks like the brand is not a warning.

`--brand-pink` keeps its name because it is referenced across the app, but now
carries **rose gold** so the family stays coherent.

---

## Canvas chrome

Konva paints to a `<canvas>` and cannot read CSS variables. Selection handles and
alignment guides would therefore hardcode a hex value and drift on any retheme.

[`useCanvasThemeColors`](../apps/client/modules/studio/hooks/use-theme-colors.ts)
resolves the tokens through `getComputedStyle` once, and re-reads them whenever the
theme class on `<html>` changes — so canvas chrome tracks light/dark and any future
palette automatically.

---

## Retheming

Edit the two blocks in `globals.css`. Then check the pairings that carry text:

- `primary` on `card` (links, active nav)
- `primary-foreground` on `primary` (buttons)
- `muted-foreground` on `card` (secondary text)
- `foreground` on `background` (body)

If the new brand colour is light (gold, yellow, lime, cyan), expect to need dark
`primary-foreground` in dark mode and a deeper primary in light mode — exactly the
split above.

Target ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI boundaries.

---

## What is deliberately *not* themed

The **colour-picker presets** and the **ten template palettes** are content, not
chrome. You are designing advertisements; restricting the picker to the app's own
palette would be a downgrade.

The dashboard's fallback project gradients *are* constrained — to a warm 40°–120°
band — so a grid of projects reads as one set rather than a rainbow, while each
project stays individually recognisable.
