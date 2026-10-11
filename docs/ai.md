# AI generation

[← Back to README](../README.md)

Source: [`apps/server/src/module/ai/`](../apps/server/src/module/ai/)

---

## The shape

A language model is good at writing an advertisement's *words*. It is unreliable at
producing two hundred lines of positioned, timed, animated layers. So it is never
asked to.

```
User description
      │
      ▼
   AdPlanner ──────────────► AdvertisementPlan
   (LLM, or offline)          headline, scenes, CTA, palette
      │                                │
      │                    zod-validated (narrow schema)
      │                                ▼
      │                       compilePlanToDocument()
      │                    deterministic — every coordinate,
      │                    z-index, timing and animation
      │                    is chosen by code, not the model
      │                                ▼
      │                       parseProjectDocument()
      │                                ▼
      └──────────────────────────► Editor
```

Two guarantees fall out of this:

1. **The model never positions anything.** It supplies words and colours; the
   compiler decides layout.
2. **Raw output never reaches the editor.** The plan is validated against a narrow
   schema, and the compiled document is validated again before anyone sees it.

The plan schema is also a far smaller attack surface than a full project document.

---

## The plan

```ts
{
  headline: string          // ≤ 60 chars
  subheadline?: string      // ≤ 90
  scenes: [                 // 1–5
    { title: string         // ≤ 60
      body?: string         // ≤ 140
      caption?: string      // ≤ 50, an ALL-CAPS label
      icon?: string }       // must match the icon allow-list, else dropped
  ]
  cta: string               // ≤ 30
  palette: string[]         // 2–5 hex colours
  backgroundStyle: "dark" | "light" | "gradient"
}
```

---

## Two planners

`planAdvertisement()` picks one and falls back on any failure.

### `OpenAiAdPlanner`

Uses the existing `OpenAIService` (LangChain + `gpt-4o-mini`). The prompt pins every
length limit and restricts `icon` to the allow-list. The response is parsed out of
any prose or code fences, then run through `advertisementPlanSchema` — a model that
hallucinates a 400-character headline is rejected here, not downstream.

### `HeuristicAdPlanner`

Used when no API key is configured, **and** whenever the model call fails.

This is not a stub. It splits the user's description into sentences and builds a
real, structured advert from their own words — scene count derived from the
requested duration, palette from the chosen style. "Generate with AI" always
produces an editable project rather than an error, and the whole
generate → compile → editor path stays testable without a network call.

The UI says which one produced the result, so an offline plan is never passed off as
a model's work.

---

## The compiler

[`plan-compiler.ts`](../apps/server/src/module/ai/plan-compiler.ts) — entirely
deterministic.

Given a plan and a canvas it lays out:

1. Two ambient gradient blooms from the palette, drifting for the full duration
2. A title scene — headline (zoom-in, overshoot) plus optional subheadline
3. One beat per planned scene — optional icon, ALL-CAPS caption, title, body, with
   entrances alternating between slide-left and slide-up
4. A CTA pill with a bounce-in and a slow pulse

A story-style progress bar runs along the top. Stage-level scene transitions are
off, because they would also move the background; per-layer entrances and exits
carry the motion.

**Layout is a measured stack, so nothing can overlap.** Each screen (opening, one
per scene, CTA) is a vertical stack: icon, caption, title, accent rule, body.
[`text-layout.ts`](../apps/server/src/module/ai/text-layout.ts) estimates glyph
widths conservatively and wraps every block with *explicit* line breaks, which
are balanced so lines come out even. Each box is sized to its real line count,
plus horizontal slack so a wider fallback font never re-wraps. If the stack is
taller than the platform-safe area, the whole screen's type scales down together.
Screens get back-to-back time windows weighted by reading length, so two screens
are never on screen at once. `ai-layout.test.ts` checks this against
maximum-length copy on every canvas shape.

The final `parseProjectDocument()` is the guard: if anything above produced an
out-of-range value it throws rather than persisting a document the renderer cannot
read.

---

## Media: background image or video, and audio

The dialog takes an optional background (image **or** video) and audio file. Both upload immediately
through the normal signed asset flow, and the request sends only their asset
ids (`backgroundAssetId`, `audioAssetId`). The server resolves the ids
itself in [`generation-media.ts`](../apps/server/src/module/ai/generation-media.ts),
so a client cannot point generation at an arbitrary URL.

- **The AI sees the image.** It is downsized to 768px and sent to the model
  with `detail: "low"`, along with its dominant colours, so the copy and
  palette match the photo. Without a key, the offline planner still takes its
  palette from the image's most vivid colours.
- **For a video, the AI sees three frames** (start, middle, end), extracted with
  the ffmpeg that ships with Remotion. No system ffmpeg is needed.
- **The image becomes the background.** It is a full-bleed `image` layer with a
  slow push-in, under a neutral dark overlay whose strength follows the photo's
  brightness. Text is always light over the background.
- **A video plays full-bleed.** A clip shorter than the short loops as
  back-to-back copies; a very short clip is also slowed down, so there are never
  more than 8 copies. The clip keeps its own sound only when no separate audio
  was added; with music it is muted.
- **The audio becomes the music bed.** It starts at 0, is trimmed to the
  short's length, and fades in and out.

## Endpoint

`POST /v1/ai/advertisements` returns a **document, not a project** — nothing is
written to the database.

```jsonc
{ "subject": "College Tech Fest",
  "description": "Annual technology festival for students. 40+ events…",
  "style": "modern",              // modern|bold|minimal|playful|elegant|technical
  "preset": "instagram-reel",
  "duration": 10 }
```

The dialog shows the plan — headline, scene breakdown, CTA, palette — **before**
anything is created. Accepting it calls `POST /projects` with the document, which
validates it a third time.

---

## Configuration

```bash
# apps/server/.env
OPEN_AI_API_KEY="sk-…"     # OPENAI_API_KEY is accepted too
AI_MODEL="gpt-4o-mini"     # any chat model that supports JSON mode
```

The request uses OpenAI JSON mode. Copy that runs slightly over a length limit
is trimmed on a word boundary rather than rejected. If the call fails (bad key,
no quota, timeout), the offline planner takes over and the review step shows
the reason.

---

## Adding a provider

Implement one interface:

```ts
export interface AdPlanner {
  readonly name: string;
  plan(input: GenerateAdvertisementInput): Promise<AdvertisementPlan>;
}
```

…and add it to `planAdvertisement()`. Nothing else changes — no AI logic lives in the
editor, the schema or the compiler.

---

## Tested

- A heuristic plan compiles to a **valid** document
- Every generated layer stays inside the project duration
- No unknown icon name can be emitted
- A caller-supplied palette is respected
