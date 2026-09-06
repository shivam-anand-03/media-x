# Templates

[← Back to README](../README.md)

Source: [`packages/motion/src/templates/`](../packages/motion/src/templates/)

---

## What a template is

A complete, valid `ProjectDocument` — the same shape the editor saves. "Use template"
is a straight copy, so there is no separate template format that could drift from
what the editor understands. Every one is fully editable: real layers, real timing,
real animations.

They are seeded into MongoDB on every boot as an idempotent upsert keyed on `slug`,
so restarting updates definitions in place rather than duplicating them, and
`usageCount` is never reset.

---

## The library

| Slug | Category | Format | Length |
|---|---|---|---|
| `college-tech-fest` | Event | 9:16 | 10 s |
| `product-sale` | Sale | 9:16 | 10 s |
| `restaurant-promotion` | Restaurant | 1:1 | 8 s |
| `workshop-announcement` | Education | 9:16 | 10 s |
| `startup-product-launch` | Technology | 16:9 | 12 s |
| `event-invitation` | Event | 1:1 | 8 s |
| `new-product` | Product | 9:16 | 10 s |
| `flash-sale` | Sale | 9:16 | 6 s |
| `corporate-announcement` | Corporate | 16:9 | 12 s |
| `minimal-product-ad` | Minimal | 1:1 | 8 s |

Browse categories: Featured, Social Media, Product, Event, Education, Restaurant,
Business, Technology, Sale, Minimal, Corporate. A template lists under its primary
category or any of its tags.

`college-tech-fest` doubles as the sample project — three scenes, eleven layers:

```
0–2s   Logo + headline      TECHFEST 2026, zoom-in, tracked caption
2–4s   Event information    Build. Innovate. Compete.
4–8s   Competition          COMPETE WITH THE BEST + trophy icon
8–10s  Call to action       Date + "Register Now" pill
```

---

## Authoring one

Templates are written with a small builder that resolves typography presets, sizes
type relative to the canvas, and assigns z-indices in declaration order.

```ts
const myTemplate = template(
  { width: 1080, height: 1920, duration: 10 },   // canvas
  { type: "gradient", from: "#1e1065", to: "#05030c", angle: 165 },
  "my-slug",                                      // id prefix
)
  .glow("#7c3aed", "#0b0713", 1.5,
        { at: 0 },                                // timing
        { x: 0.2, y: 0.18 },                      // placement, 0–1 of the canvas
        { enter: "fadeIn", enterDuration: 1.2, loop: "float", loopDuration: 8 })

  .text("caption", "ANNUAL FESTIVAL",
        { at: 0.2, for: 3 },
        { x: 0.5, y: 0.3 },
        { enter: "fadeIn", exit: "fadeOut" },
        { color: "#c4b5fd" })                     // property overrides

  .text("heading", "TECHFEST\n2026",
        { at: 0.5, for: 3.5 }, { x: 0.5, y: 0.44 },
        { enter: "zoomIn", enterEasing: "easeOutBack" })

  .icon("trophy", "#facc15", 0.16, { at: 5, for: 2.6 }, { x: 0.5, y: 0.66 },
        { enter: "bounceIn", loop: "float" })

  .shape({ kind: "roundedRect", fill: "#a855f7", strokeWidth: 0, cornerRadius: 32 },
         { w: 0.22, h: 0.004 }, { at: 1.2, for: 2.6 }, { x: 0.5, y: 0.56 })

  .scene("Opening", 0, 4, { type: "fade" })
  .scene("Call to action", 8, 2, { type: "zoom" })

  .build(["#a855f7", "#ec4899"]);                 // palette
```

Then register it in `TEMPLATE_LIBRARY`:

```ts
{
  slug: "my-slug",
  name: "My Template",
  description: "One sentence on what it is for.",
  category: "Event",
  tags: ["Featured", "Social Media"],
  featured: true,
  accent: ["#7c3aed", "#ec4899"],   // paints the browser card
  document: myTemplate,
}
```

### Builder reference

| Method | Adds |
|---|---|
| `.text(preset, text, timing, placement?, anim?, overrides?)` | Text sized from a typography preset |
| `.shape(properties, size, timing, placement?, anim?)` | Shape sized as fractions of the canvas |
| `.icon(name, color, size, timing, placement?, anim?)` | Icon from the allow-list |
| `.glow(from, to, size, timing, placement?, anim?, kind?, blur?)` | Decorative gradient bloom |
| `.scene(name, at, duration, transition?)` | A scene beat |
| `.build(palette?)` | The finished document |

- **Timing** — `{ at, for? }` in seconds; `for` defaults to "until the end".
- **Placement** — `{ x, y, rotation?, opacity? }` as **fractions** of the canvas, so
  the same numbers work at any size.
- **Typography presets** — `heading`, `subheading`, `body`, `caption`, `cta`. Sizes
  are a fraction of canvas width, so a preset reads the same at 1080 or 1920.

### Type is fitted, not wrapped

Templates put their line breaks in explicitly, so an automatic wrap is always a
layout accident. If a line would not fit across the canvas the builder **shrinks the
font** rather than letting the renderer wrap it.

The width estimate accounts for weight, letter spacing, and whether the copy is
capitals — including text that is *already* typed in capitals, which `textTransform`
does not reflect. A flat "0.56em per character" guess is what previously broke
`TECHFEST` across two lines mid-word.

A test asserts every text layer in every template has a box wide enough for its own
copy, so this cannot silently regress.

---

## Format changes

Templates can be used at any canvas size. `ProjectService.rescaleDocument` scales by
the smaller axis ratio and re-centres, so a 9:16 template on a 16:9 canvas stays
composed instead of sitting in a corner.

Font size, padding **and letter spacing** all scale with it — letter spacing is in
pixels, so leaving it fixed makes tracked captions overflow once the type shrinks.

---

## Applying one in the editor

The Templates panel replaces the current canvas but **keeps the project's own
canvas** — only the content comes from the template. It goes through
`replaceDocument`, so it is a single undo away.

Documents are fetched on demand: the panel and browser render from lightweight
summaries rather than downloading ten complete projects to draw ten cards.
