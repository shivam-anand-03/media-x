# Data model

[← Back to README](../README.md)

Defined in [`packages/motion/src/schema.ts`](../packages/motion/src/schema.ts).

---

## The project document

One JSON document describes an entire advertisement. It is the source of truth for
the editor, the preview, the export, autosave, templates and AI generation.

```jsonc
{
  "version": 1,
  "canvas":     { "width": 1080, "height": 1920, "fps": 30, "duration": 10 },
  "background": { "type": "gradient", "from": "#3d2f0a", "to": "#0d0a05", "angle": 165 },
  "layers":      [ /* … */ ],
  "audioTracks": [ /* … */ ],
  "scenes":      [ /* … */ ],
  "palette":     ["#d4af37", "#f4e4bc"]   // swatches offered in the colour picker
}
```

### Limits

Bounded so one render job cannot cost unbounded time:

| | Max |
|---|---|
| Layers | 200 |
| Audio tracks | 24 |
| Scenes | 40 |
| Duration | 300 s |

---

## Layers

A discriminated union on `type`, so `properties` is exactly typed per kind. The
inspector renders contextual controls with no casting, and an `image` layer cannot
be persisted without a `src`.

```ts
{
  id: string
  type: "text" | "image" | "video" | "shape" | "icon" | "gradient"
  name: string

  startTime: number        // seconds from the start of the ad
  duration:  number
  zIndex:    number        // dense 0..n-1, back to front

  locked: boolean
  hidden: boolean
  blendMode: BlendMode

  transform: {
    x, y                   // CENTRE of the layer, in canvas pixels
    width, height          // untransformed box
    scaleX, scaleY
    rotation               // degrees
    opacity                // 0–1
  }

  animation: { enter?, exit?, loop? }
  properties: /* per type */
}
```

**Why centre-anchored?** Rotation and scale animations behave the way a designer
expects without every consumer re-deriving an origin. Every renderer translates by
`-50%, -50%`.

### Properties by type

| Type | Key fields |
|---|---|
| `text` | `text`, `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `textTransform`, `align`, `color`, `lineHeight`, `letterSpacing`, plus optional `backgroundColor`/`backgroundRadius`/`paddingX`/`paddingY` (this is how CTA pills are expressed) |
| `image` | `src`, `fit`, `cornerRadius`, `brightness`, `contrast`, `saturation`, `blur` |
| `video` | `src`, `fit`, `cornerRadius`, `volume`, `muted`, `trimStart`, `playbackRate` |
| `shape` | `kind` (rectangle · roundedRect · circle · line · arrow · triangle · star), `fill`, `stroke`, `strokeWidth`, `cornerRadius` |
| `icon` | `name` (from a 48-icon allow-list), `color`, `strokeWidth` |
| `gradient` | `kind` (linear · radial · blob), `from`, `to`, `angle`, `blur` |

---

## Animation

```ts
animation: {
  enter?: { type, duration, delay, easing, intensity }
  exit?:  { type, duration, delay, easing, intensity }
  loop?:  { type, duration, delay, easing, intensity }
}
```

| Slot | Options |
|---|---|
| Entrance | fadeIn, slideLeft/Right/Up/Down, zoomIn, bounceIn, rotateIn, blurIn, wipeIn |
| Exit | fadeOut, slideLeft/Right/Up/Down, zoomOut, blurOut |
| Loop | pulse, float, shake, rotate, glow |
| Easing | linear, ease, easeIn/Out/InOut, easeOutBack, easeOutElastic, easeOutBounce |

`intensity` (0–2) is one normalised knob scaling how far an animation travels — a
slide's distance, a zoom's starting scale. The inspector exposes one slider instead
of per-animation magic numbers.

**Timing rules.** Entrance runs forward from `startTime + delay`. Exit is anchored to
the *end* of the layer's span, so it always lands exactly as the layer leaves,
however long the layer is on screen. Loops run on a free phase, independent of
progress.

---

## Audio tracks

```ts
{
  id, name, src
  kind: "music" | "sfx" | "voiceover"
  startTime, duration        // position on the ad timeline
  trimStart                  // offset into the source file
  volume, fadeIn, fadeOut
  muted, locked
}
```

`resolveAudioVolumeAtTime` computes gain including fades, and is used by both the
editor's playback and the Remotion audio mix — so what you scrub is what you hear.

---

## Scenes and transitions

Scenes group the timeline into beats. A transition animates the *incoming* scene, so
layers inside it inherit the motion without each needing its own animation.

```ts
{ id, name, startTime, duration,
  transition: { type: none|fade|slide|zoom|blur|wipe, duration, easing, direction } }
```

---

## Validation

```ts
parseProjectDocument(input)      // throws
safeParseProjectDocument(input)  // { success, data | error }
```

Called on every path where a document enters the system:

| Where | Why |
|---|---|
| `POST /projects`, `PATCH /projects/:id` | Client-authored JSON is never trusted |
| Template seeding | Authored data, but still data |
| AI compiler output | Guarantees generated documents are valid before they reach anyone |
| **Inside the render worker** | The stored snapshot was client-authored once; re-checked before Chrome sees it |
| Editor load | A document from an older schema surfaces as an error, not a blank canvas |

Two rules deserve calling out:

- **Colours** must be `#rgb`, `#rrggbb` or `#rrggbbaa`, so no renderer has to guess
  at a CSS string it cannot parse.
- **Asset URLs** must be `http(s)` or a base64 `data:` URL. This is what stops a
  document from pointing the render worker at `file:///etc/passwd`.

---

## Database collections

MongoDB via Mongoose. Documents are stored as `Mixed` — the shape is owned by zod,
not Mongoose, which is the JSONB equivalent the brief called for.

### `projects`

| Field | Notes |
|---|---|
| `userId` | Indexed; part of every query |
| `name`, `description` | |
| `width`, `height`, `fps`, `duration` | Denormalised from the document for list views |
| `projectData` | The full document |
| `status` | DRAFT · READY · EXPORTED · ARCHIVED |
| `thumbnail` | Data URL poster frame captured in the editor |
| `revision` | Incremented per save; see below |

Indexes: `{userId, updatedAt}`, `{userId, status, updatedAt}` — the dashboard's sort
is served by the index rather than in memory. List queries `select("-projectData")`;
24 full documents would be megabytes.

**Revisions.** Clients send the `baseRevision` they edited from. If it is stale the
write is rejected with `REVISION_CONFLICT`, so a second tab cannot silently clobber
a newer save.

### `assets`

Binary content never lives here — only a storage pointer plus the metadata the
editor needs to place the file without downloading it.

`userId`, `projectId?`, `type` (IMAGE·VIDEO·AUDIO·LOGO), `status`
(PENDING·READY·FAILED), `filename`, `mimeType`, `size`, `storagePath`, `url`,
`thumbnailUrl`, `metadata {width, height, duration}`.

### `templates`

`slug` (unique), `name`, `description`, `category`, `tags`, `featured`, `accent`,
dimensions, `sceneCount`, `layerCount`, `projectData`, `usageCount`.

`projectData` is a complete project document — "use template" is a straight copy, so
there is no separate template format that could drift from what the editor reads.

### `exportJobs`

`userId`, `projectId`, `status`, `progress`, `stage`, `format`, `quality`,
`width`, `height`, `fps`, `durationSeconds`, `projectSnapshot`, `outputUrl`,
`storagePath`, `fileSize`, `errorCode`, `errorDetail`, `attempt`, `rootJobId`,
`queueJobId`, timestamps.

Two deliberate choices:

- **`projectSnapshot`** freezes what was rendered, so a completed export always
  describes the video that actually exists — even after the user keeps editing.
- **`toJSON` strips `projectSnapshot` and `errorDetail`.** The snapshot can be
  hundreds of KB and the client already has the document; `errorDetail` holds stack
  traces that must never reach a browser. The client gets `errorCode` instead.
