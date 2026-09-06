import { describe, expect, it } from "vitest";
import {
  addLayer,
  canRetry,
  canTransition,
  collectProjectColors,
  createShapeLayer,
  createTextLayer,
  duplicateLayers,
  estimateRenderSeconds,
  estimateTextWidth,
  isTerminal,
  normalizeZIndices,
  overallProgress,
  parseProjectDocument,
  removeLayers,
  reorderLayers,
  resolveAudioVolumeAtTime,
  resolveLayerAtTime,
  resolveOutputSize,
  resolveTransition,
  safeParseProjectDocument,
  SAMPLE_PROJECT,
  setLayerTiming,
  setProjectDuration,
  sortByZIndex,
  TEMPLATE_LIBRARY,
  totalFrames,
  updateLayer,
  type Layer,
  type ProjectDocument,
} from "../index.js";

const ctx = (id: string, zIndex = 0) => ({
  canvasWidth: 1080,
  canvasHeight: 1920,
  startTime: 0,
  duration: 5,
  zIndex,
  id,
});

function baseDoc(layers: Layer[] = []): ProjectDocument {
  return {
    version: 1,
    canvas: { width: 1080, height: 1920, fps: 30, duration: 10 },
    background: { type: "solid", value: "#000000" },
    layers,
    audioTracks: [],
    scenes: [],
    palette: [],
  };
}

// ---------------------------------------------------------------------------
// Schema — the trust boundary
// ---------------------------------------------------------------------------

describe("project schema", () => {
  it("accepts every shipped template", () => {
    for (const t of TEMPLATE_LIBRARY) {
      const result = safeParseProjectDocument(t.document);
      if (!result.success) {
        throw new Error(`${t.slug} is invalid: ${JSON.stringify(result.error.issues, null, 2)}`);
      }
      expect(result.success).toBe(true);
    }
  });

  it("accepts the sample project", () => {
    expect(safeParseProjectDocument(SAMPLE_PROJECT).success).toBe(true);
  });

  it("rejects a non-http asset URL", () => {
    const doc = baseDoc([
      {
        id: "a",
        type: "image",
        name: "bad",
        startTime: 0,
        duration: 2,
        zIndex: 0,
        locked: false,
        hidden: false,
        blendMode: "normal",
        animation: {},
        transform: { x: 0, y: 0, width: 10, height: 10, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        properties: {
          src: "file:///etc/passwd",
          fit: "cover",
          cornerRadius: 0,
          brightness: 100,
          contrast: 100,
          saturation: 100,
          blur: 0,
        },
      },
    ]);
    expect(safeParseProjectDocument(doc).success).toBe(false);
  });

  it("rejects duplicate layer ids", () => {
    const layer = createTextLayer(ctx("dup"), "heading", "Hello");
    const doc = baseDoc([layer, { ...layer }]);
    expect(safeParseProjectDocument(doc).success).toBe(false);
  });

  it("rejects an invalid hex colour", () => {
    const doc = baseDoc();
    doc.background = { type: "solid", value: "not-a-colour" as never };
    expect(safeParseProjectDocument(doc).success).toBe(false);
  });

  it("applies defaults for omitted optional fields", () => {
    const parsed = parseProjectDocument({
      canvas: { width: 1080, height: 1080 },
      background: { type: "solid", value: "#fff" },
    });
    expect(parsed.version).toBe(1);
    expect(parsed.canvas.fps).toBe(30);
    expect(parsed.layers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Layer operations
// ---------------------------------------------------------------------------

describe("layer operations", () => {
  it("adds a layer and keeps z-indices dense", () => {
    let doc = baseDoc();
    doc = addLayer(doc, createTextLayer(ctx("a", 0), "heading", "A"));
    doc = addLayer(doc, createTextLayer(ctx("b", 5), "body", "B"));
    expect(doc.layers.map((l) => l.zIndex)).toEqual([0, 1]);
  });

  it("deletes layers and renumbers the remainder", () => {
    let doc = baseDoc();
    for (const id of ["a", "b", "c"]) doc = addLayer(doc, createTextLayer(ctx(id), "body", id));
    doc = removeLayers(doc, ["b"]);
    expect(doc.layers.map((l) => l.id)).toEqual(["a", "c"]);
    expect(doc.layers.map((l) => l.zIndex)).toEqual([0, 1]);
  });

  it("returns the same document when deleting nothing", () => {
    const doc = baseDoc([createTextLayer(ctx("a"), "body", "A")]);
    expect(removeLayers(doc, ["missing"])).toBe(doc);
  });

  it("duplicates a layer with a fresh id and an offset", () => {
    const doc = baseDoc([createTextLayer(ctx("a"), "heading", "A")]);
    const { document, newIds } = duplicateLayers(doc, ["a"]);
    expect(document.layers).toHaveLength(2);
    expect(newIds).toHaveLength(1);
    expect(newIds[0]).not.toBe("a");
    const copy = document.layers.find((l) => l.id === newIds[0])!;
    const original = doc.layers[0]!;
    expect(copy.transform.x).toBe(original.transform.x + 32);
    expect(copy.name).toBe("A copy");
  });

  it("updates a layer immutably", () => {
    const doc = baseDoc([createTextLayer(ctx("a"), "heading", "A")]);
    const next = updateLayer(doc, "a", (l) => ({ ...l, name: "Renamed" }));
    expect(next.layers[0]!.name).toBe("Renamed");
    expect(doc.layers[0]!.name).toBe("A");
  });

  it("moves a layer forward one step only", () => {
    const layers = ["a", "b", "c"].map((id, i) => createShapeLayer(ctx(id, i), "rectangle"));
    const reordered = reorderLayers(layers, ["a"], "forward");
    expect(sortByZIndex(reordered).map((l) => l.id)).toEqual(["b", "a", "c"]);
  });

  it("brings a layer to the front and sends it to the back", () => {
    const layers = ["a", "b", "c"].map((id, i) => createShapeLayer(ctx(id, i), "rectangle"));
    expect(sortByZIndex(reorderLayers(layers, ["a"], "front")).map((l) => l.id)).toEqual(["b", "c", "a"]);
    expect(sortByZIndex(reorderLayers(layers, ["c"], "back")).map((l) => l.id)).toEqual(["c", "a", "b"]);
  });

  it("keeps a multi-selection together when reordering", () => {
    const layers = ["a", "b", "c", "d"].map((id, i) => createShapeLayer(ctx(id, i), "rectangle"));
    const reordered = reorderLayers(layers, ["a", "b"], "forward");
    expect(sortByZIndex(reordered).map((l) => l.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("does not move past the edge of the stack", () => {
    const layers = ["a", "b"].map((id, i) => createShapeLayer(ctx(id, i), "rectangle"));
    expect(sortByZIndex(reorderLayers(layers, ["a"], "backward")).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("normalises sparse z-indices without changing order", () => {
    const layers = [
      { ...createShapeLayer(ctx("a"), "rectangle"), zIndex: 40 },
      { ...createShapeLayer(ctx("b"), "rectangle"), zIndex: 9 },
    ];
    expect(normalizeZIndices(layers).map((l) => [l.id, l.zIndex])).toEqual([
      ["b", 0],
      ["a", 1],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

describe("timeline timing", () => {
  it("clamps a clip dragged past the end of the project", () => {
    const doc = baseDoc([createTextLayer(ctx("a"), "heading", "A")]);
    const next = setLayerTiming(doc, "a", { startTime: 99 });
    // duration is 5, project is 10 → the furthest valid start is 5.
    expect(next.layers[0]!.startTime).toBe(5);
  });

  it("clamps a negative start time to zero", () => {
    const doc = baseDoc([createTextLayer(ctx("a"), "heading", "A")]);
    expect(setLayerTiming(doc, "a", { startTime: -3 }).layers[0]!.startTime).toBe(0);
  });

  it("caps a clip duration at the project duration", () => {
    const doc = baseDoc([createTextLayer(ctx("a"), "heading", "A")]);
    expect(setLayerTiming(doc, "a", { duration: 500 }).layers[0]!.duration).toBe(10);
  });

  it("refits every clip when the project is shortened", () => {
    let doc = baseDoc([createTextLayer({ ...ctx("a"), startTime: 6, duration: 4 }, "heading", "A")]);
    doc = setProjectDuration(doc, 5);
    const layer = doc.layers[0]!;
    expect(doc.canvas.duration).toBe(5);
    expect(layer.startTime + layer.duration).toBeLessThanOrEqual(5);
  });

  it("computes total frames from duration and fps", () => {
    expect(totalFrames(baseDoc())).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Animation engine
// ---------------------------------------------------------------------------

describe("animation engine", () => {
  const layer = (over: Partial<Layer> = {}): Layer => ({
    ...createShapeLayer({ ...ctx("a"), startTime: 2, duration: 4 }, "rectangle"),
    ...over,
  }) as Layer;

  it("hides a layer before it starts and after it ends", () => {
    const l = layer();
    expect(resolveLayerAtTime(l, 1.9).visible).toBe(false);
    expect(resolveLayerAtTime(l, 2).visible).toBe(true);
    expect(resolveLayerAtTime(l, 5.9).visible).toBe(true);
    expect(resolveLayerAtTime(l, 6).visible).toBe(false);
  });

  it("hides a layer flagged hidden even inside its span", () => {
    expect(resolveLayerAtTime(layer({ hidden: true }), 3).visible).toBe(false);
  });

  it("ramps opacity across a fade in and settles at full", () => {
    const l = layer({
      animation: { enter: { type: "fadeIn", duration: 1, delay: 0, easing: "linear", intensity: 1 } },
    });
    expect(resolveLayerAtTime(l, 2).opacity).toBeCloseTo(0, 5);
    expect(resolveLayerAtTime(l, 2.5).opacity).toBeCloseTo(0.5, 2);
    expect(resolveLayerAtTime(l, 3.5).opacity).toBeCloseTo(1, 5);
  });

  it("keeps a delayed entrance invisible until its delay elapses", () => {
    const l = layer({
      animation: { enter: { type: "fadeIn", duration: 0.5, delay: 1, easing: "linear", intensity: 1 } },
    });
    expect(resolveLayerAtTime(l, 2.5).opacity).toBe(0);
    expect(resolveLayerAtTime(l, 3.25).opacity).toBeCloseTo(0.5, 1);
  });

  it("anchors an exit to the end of the layer span", () => {
    const l = layer({
      animation: { exit: { type: "fadeOut", duration: 1, delay: 0, easing: "linear", intensity: 1 } },
    });
    // Span is 2s–6s, so a 1s fade out starts at 5s.
    expect(resolveLayerAtTime(l, 4.9).opacity).toBeCloseTo(1, 2);
    expect(resolveLayerAtTime(l, 5.5).opacity).toBeCloseTo(0.5, 2);
  });

  it("offsets position during a slide and lands on the transform", () => {
    const l = layer({
      animation: { enter: { type: "slideUp", duration: 1, delay: 0, easing: "linear", intensity: 1 } },
    });
    const start = resolveLayerAtTime(l, 2.01);
    const settled = resolveLayerAtTime(l, 3.5);
    expect(start.y).toBeGreaterThan(settled.y);
    expect(settled.y).toBe(l.transform.y);
    expect(settled.x).toBe(l.transform.x);
  });

  it("scales during a zoom in", () => {
    const l = layer({
      animation: { enter: { type: "zoomIn", duration: 1, delay: 0, easing: "linear", intensity: 1 } },
    });
    expect(resolveLayerAtTime(l, 2.01).scaleX).toBeLessThan(1);
    expect(resolveLayerAtTime(l, 3.5).scaleX).toBeCloseTo(1, 5);
  });

  it("keeps a loop animation oscillating around the base transform", () => {
    const l = layer({
      animation: { loop: { type: "float", duration: 2, delay: 0, easing: "easeInOut", intensity: 1 } },
    });
    const atStart = resolveLayerAtTime(l, 2);
    const atQuarter = resolveLayerAtTime(l, 2.5);
    expect(atStart.y).toBeCloseTo(l.transform.y, 5);
    expect(atQuarter.y).toBeLessThan(l.transform.y);
  });

  it("composes an entrance and a loop without losing either", () => {
    const l = layer({
      animation: {
        enter: { type: "fadeIn", duration: 1, delay: 0, easing: "linear", intensity: 1 },
        loop: { type: "float", duration: 2, delay: 0, easing: "easeInOut", intensity: 1 },
      },
    });
    const mid = resolveLayerAtTime(l, 2.5);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.y).not.toBe(l.transform.y);
  });

  it("never produces an out-of-range opacity", () => {
    const l = layer({
      animation: {
        enter: { type: "fadeIn", duration: 1, delay: 0, easing: "easeOutElastic", intensity: 2 },
        exit: { type: "fadeOut", duration: 1, delay: 0, easing: "easeOutBounce", intensity: 2 },
        loop: { type: "glow", duration: 1, delay: 0, easing: "linear", intensity: 2 },
      },
    });
    for (let t = 2; t < 6; t += 0.05) {
      const r = resolveLayerAtTime(l, t);
      expect(r.opacity).toBeGreaterThanOrEqual(0);
      expect(r.opacity).toBeLessThanOrEqual(1);
    }
  });

  it("reports local time so video layers can seek", () => {
    expect(resolveLayerAtTime(layer(), 4.5).localTime).toBeCloseTo(2.5, 5);
  });
});

describe("audio", () => {
  const track = { startTime: 1, duration: 4, volume: 1, fadeIn: 1, fadeOut: 1, muted: false };

  it("is silent outside its span", () => {
    expect(resolveAudioVolumeAtTime(track, 0.5)).toBe(0);
    expect(resolveAudioVolumeAtTime(track, 5)).toBe(0);
  });

  it("fades in and out", () => {
    expect(resolveAudioVolumeAtTime(track, 1.5)).toBeCloseTo(0.5, 2);
    expect(resolveAudioVolumeAtTime(track, 3)).toBeCloseTo(1, 2);
    expect(resolveAudioVolumeAtTime(track, 4.5)).toBeCloseTo(0.5, 2);
  });

  it("respects mute", () => {
    expect(resolveAudioVolumeAtTime({ ...track, muted: true }, 3)).toBe(0);
  });
});

describe("transitions", () => {
  it("is the identity for none", () => {
    const r = resolveTransition({ type: "none", duration: 0.5, easing: "linear", direction: "left" }, 0.5, 1080, 1920);
    expect(r.opacity).toBe(1);
    expect(r.translateX).toBe(0);
  });

  it("slides in from the direction given and settles", () => {
    const t = { type: "slide" as const, duration: 0.5, easing: "linear" as const, direction: "left" as const };
    expect(resolveTransition(t, 0, 1080, 1920).translateX).toBeCloseTo(1080, 5);
    expect(resolveTransition(t, 1, 1080, 1920).translateX).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// Export job domain
// ---------------------------------------------------------------------------

describe("export job", () => {
  it("classifies terminal states", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("QUEUED")).toBe(false);
  });

  it("allows retry only from a failed or cancelled job", () => {
    expect(canRetry("FAILED")).toBe(true);
    expect(canRetry("CANCELLED")).toBe(true);
    expect(canRetry("PROCESSING")).toBe(false);
    expect(canRetry("COMPLETED")).toBe(false);
  });

  it("permits queued → processing → completed", () => {
    expect(canTransition("QUEUED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "COMPLETED")).toBe(true);
  });

  it("refuses to resurrect a finished job", () => {
    expect(canTransition("CANCELLED", "PROCESSING")).toBe(false);
    expect(canTransition("COMPLETED", "PROCESSING")).toBe(false);
    expect(canTransition("FAILED", "COMPLETED")).toBe(false);
  });

  it("maps stage progress onto a monotonic overall bar", () => {
    expect(overallProgress("validating", 0)).toBe(0);
    expect(overallProgress("rendering", 0)).toBe(12);
    expect(overallProgress("rendering", 1)).toBe(78);
    expect(overallProgress("finalizing", 1)).toBe(100);
    expect(overallProgress("rendering", 5)).toBe(78);
  });

  it("scales output size by quality and keeps dimensions even", () => {
    const doc = baseDoc();
    expect(resolveOutputSize(doc, "high")).toEqual({ width: 1080, height: 1920 });
    const draft = resolveOutputSize(doc, "draft");
    expect(draft.width % 2).toBe(0);
    expect(draft.height % 2).toBe(0);
    expect(draft.width).toBe(540);
  });

  it("estimates longer renders for higher quality", () => {
    const doc = baseDoc();
    expect(estimateRenderSeconds(doc, "max")).toBeGreaterThan(estimateRenderSeconds(doc, "draft"));
  });
});

describe("text box sizing", () => {
  it("gives every template text layer a box wide enough for its own copy", () => {
    // Regression guard: an under-estimated box makes the renderer wrap a
    // headline mid-word, which is invisible until you look at an export.
    for (const template of TEMPLATE_LIBRARY) {
      for (const layer of template.document.layers) {
        if (layer.type !== "text") continue;
        const p = layer.properties;
        const needed = estimateTextWidth(p.text, p.fontSize, p);
        const available = layer.transform.width - p.paddingX * 2;
        expect(
          available + 0.5,
          `${template.slug}: "${p.text.split("\n")[0]}" needs ${needed.toFixed(0)}px, box is ${available.toFixed(0)}px`,
        ).toBeGreaterThanOrEqual(needed);
      }
    }
  });

  it("treats already-uppercase copy as wide as transformed uppercase", () => {
    const shouty = estimateTextWidth("TECHFEST", 100, { fontWeight: 800, textTransform: "none" });
    const transformed = estimateTextWidth("techfest", 100, { fontWeight: 800, textTransform: "uppercase" });
    expect(shouty).toBeCloseTo(transformed, 5);
  });

  it("accounts for letter spacing", () => {
    const tight = estimateTextWidth("HELLO", 40, { letterSpacing: 0 });
    const tracked = estimateTextWidth("HELLO", 40, { letterSpacing: 10 });
    expect(tracked).toBeGreaterThan(tight);
  });

  it("makes a heavier weight wider than a light one", () => {
    expect(estimateTextWidth("Sample", 40, { fontWeight: 800 })).toBeGreaterThan(
      estimateTextWidth("Sample", 40, { fontWeight: 300 }),
    );
  });
});

describe("project colours", () => {
  it("collects colours from the background and layers", () => {
    const doc = baseDoc([createTextLayer(ctx("a"), "heading", "Hi")]);
    const colors = collectProjectColors({ ...doc, background: { type: "solid", value: "#123456" } });
    expect(colors).toContain("#123456");
    expect(colors).toContain("#ffffff");
  });
});
