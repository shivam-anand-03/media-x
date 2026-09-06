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

Timing divides the runtime into a title, one beat per scene, and a CTA. Scene
transitions alternate slide and fade.

**Type is fitted to the canvas.** `fitFontSize` shrinks a long headline so it cannot
overflow — the model does not know how wide its words are.

The final `parseProjectDocument()` is the guard: if anything above produced an
out-of-range value it throws rather than persisting a document the renderer cannot
read.

---

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
OPEN_AI_API_KEY="sk-…"     # note the underscore
AI_MODEL="gpt-4o-mini"
```

> The code reads `OPEN_AI_API_KEY`. Naming it `OPENAI_API_KEY` leaves generation
> silently on the offline planner — the dialog will tell you which one ran.

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
