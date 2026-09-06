import { beforeEach, describe, expect, it } from "vitest";
import {
  createShapeLayer,
  createTextLayer,
  parseProjectDocument,
  type Layer,
  type ProjectDocument,
} from "@workspace/motion";
import { useEditorStore } from "../editor-store";

/**
 * Editor store behaviour (§50).
 *
 * These cover the operations a user can lose work to: undo/redo, delete,
 * duplicate, timing changes and clipboard. They run against the real store, so
 * a regression in history bookkeeping fails here rather than in someone's
 * unsaved project.
 */

const baseDocument = (): ProjectDocument =>
  parseProjectDocument({
    version: 1,
    canvas: { width: 1080, height: 1920, fps: 30, duration: 10 },
    background: { type: "solid", value: "#000000" },
    layers: [],
    audioTracks: [],
    scenes: [],
    palette: [],
  });

const layerCtx = (id: string, zIndex = 0) => ({
  canvasWidth: 1080,
  canvasHeight: 1920,
  startTime: 0,
  duration: 4,
  zIndex,
  id,
});

const store = () => useEditorStore.getState();

function loadWith(layers: Layer[] = []) {
  useEditorStore.getState().resetEditor();
  useEditorStore.getState().loadProject({
    id: "p1",
    name: "Test Advertisement",
    document: { ...baseDocument(), layers },
    revision: 3,
  });
}

beforeEach(() => {
  useEditorStore.getState().resetEditor();
});

describe("loading", () => {
  it("loads a project and starts clean", () => {
    loadWith();
    const s = store();
    expect(s.projectId).toBe("p1");
    expect(s.projectName).toBe("Test Advertisement");
    expect(s.revision).toBe(3);
    expect(s.saveState).toBe("saved");
    expect(s.past).toHaveLength(0);
  });

  it("clears prior state when a different project is loaded", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().selectLayer("a");
    store().setCurrentTime(4);

    loadWith();
    expect(store().selectedLayerIds).toEqual([]);
    expect(store().currentTime).toBe(0);
  });
});

describe("adding layers", () => {
  it("adds a layer, selects it and marks the project dirty", () => {
    loadWith();
    const layer = createTextLayer(layerCtx("a"), "heading", "Hello");
    store().addLayer(layer);

    const s = store();
    expect(s.document?.layers).toHaveLength(1);
    expect(s.selectedLayerIds).toEqual(["a"]);
    expect(s.saveState).toBe("dirty");
    expect(s.dirtyCounter).toBe(1);
  });

  it("adds several layers at once", () => {
    loadWith();
    store().addLayers([
      createTextLayer(layerCtx("a", 0), "heading", "A"),
      createShapeLayer(layerCtx("b", 1), "circle"),
    ]);
    expect(store().document?.layers).toHaveLength(2);
    expect(store().selectedLayerIds).toEqual(["a", "b"]);
  });
});

describe("undo and redo", () => {
  it("undoes an add", () => {
    loadWith();
    store().addLayer(createTextLayer(layerCtx("a"), "heading", "A"));
    expect(store().document?.layers).toHaveLength(1);

    store().undo();
    expect(store().document?.layers).toHaveLength(0);
  });

  it("redoes an undone add", () => {
    loadWith();
    store().addLayer(createTextLayer(layerCtx("a"), "heading", "A"));
    store().undo();
    store().redo();
    expect(store().document?.layers).toHaveLength(1);
  });

  it("undoes a delete and brings the layer back intact", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "Keep me")]);
    store().selectLayer("a");
    store().removeSelectedLayers();
    expect(store().document?.layers).toHaveLength(0);

    store().undo();
    const restored = store().document?.layers[0];
    expect(restored?.id).toBe("a");
    expect(restored?.type === "text" && restored.properties.text).toBe("Keep me");
  });

  it("restores the selection that was active at the time of the snapshot", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().selectLayer("a");
    store().removeSelectedLayers();
    expect(store().selectedLayerIds).toEqual([]);

    store().undo();
    expect(store().selectedLayerIds).toEqual(["a"]);
  });

  it("undoes a colour change", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().updateLayer("a", (l) =>
      l.type === "text" ? { ...l, properties: { ...l.properties, color: "#ff0000" } } : l,
    );
    const changed = store().document?.layers[0];
    expect(changed?.type === "text" && changed.properties.color).toBe("#ff0000");

    store().undo();
    const reverted = store().document?.layers[0];
    expect(reverted?.type === "text" && reverted.properties.color).toBe("#ffffff");
  });

  it("undoes a timing change", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().setLayerTiming("a", { startTime: 3 });
    expect(store().document?.layers[0]?.startTime).toBe(3);

    store().undo();
    expect(store().document?.layers[0]?.startTime).toBe(0);
  });

  it("undoes an animation change", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().updateLayer("a", (l) => ({
      ...l,
      animation: { enter: { type: "zoomIn", duration: 1, delay: 0, easing: "easeOut", intensity: 1 } },
    }));
    expect(store().document?.layers[0]?.animation.enter?.type).toBe("zoomIn");

    store().undo();
    expect(store().document?.layers[0]?.animation.enter?.type).toBe("fadeIn");
  });

  it("drops the redo branch once a new edit is made", () => {
    loadWith();
    store().addLayer(createTextLayer(layerCtx("a"), "heading", "A"));
    store().undo();
    store().addLayer(createShapeLayer(layerCtx("b"), "circle"));

    expect(store().future).toHaveLength(0);
    store().redo();
    expect(store().document?.layers.map((l) => l.id)).toEqual(["b"]);
  });

  it("is a no-op when there is nothing to undo or redo", () => {
    loadWith();
    expect(() => {
      store().undo();
      store().redo();
    }).not.toThrow();
    expect(store().document?.layers).toHaveLength(0);
  });

  it("collapses a whole drag gesture into one undo step", () => {
    loadWith([createShapeLayer(layerCtx("a"), "rectangle")]);
    const startX = store().document!.layers[0]!.transform.x;

    // What the canvas does on drag: open a gesture, stream transient updates.
    store().beginInteraction("a");
    for (let x = 1; x <= 20; x++) {
      store().patchLayerTransform("a", { x: startX + x }, { transient: true });
    }
    store().endInteraction();

    expect(store().document?.layers[0]?.transform.x).toBe(startX + 20);
    store().undo();
    expect(store().document?.layers[0]?.transform.x).toBe(startX);
  });

  it("caps history growth", () => {
    loadWith([createShapeLayer(layerCtx("a"), "rectangle")]);
    for (let i = 0; i < 150; i++) {
      store().patchLayerTransform("a", { x: 100 + i });
    }
    expect(store().past.length).toBeLessThanOrEqual(100);
  });
});

describe("selection", () => {
  beforeEach(() => {
    loadWith([
      createTextLayer(layerCtx("a", 0), "heading", "A"),
      createShapeLayer(layerCtx("b", 1), "circle"),
    ]);
  });

  it("replaces the selection by default", () => {
    store().selectLayer("a");
    store().selectLayer("b");
    expect(store().selectedLayerIds).toEqual(["b"]);
  });

  it("adds to the selection when additive", () => {
    store().selectLayer("a");
    store().selectLayer("b", { additive: true });
    expect(store().selectedLayerIds).toEqual(["a", "b"]);
  });

  it("toggles an already-selected layer out of an additive selection", () => {
    store().selectLayers(["a", "b"]);
    store().selectLayer("a", { additive: true });
    expect(store().selectedLayerIds).toEqual(["b"]);
  });

  it("selects everything except locked layers", () => {
    store().toggleLayerLock("b");
    store().selectAll();
    expect(store().selectedLayerIds).toEqual(["a"]);
  });
});

describe("locking and visibility", () => {
  it("refuses to delete a locked layer", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().toggleLayerLock("a");
    store().selectLayer("a");
    store().removeSelectedLayers();
    expect(store().document?.layers).toHaveLength(1);
  });

  it("refuses to nudge a locked layer", () => {
    loadWith([createShapeLayer(layerCtx("a"), "rectangle")]);
    const x = store().document!.layers[0]!.transform.x;
    store().toggleLayerLock("a");
    store().selectLayer("a");
    store().nudgeSelection(10, 0);
    expect(store().document?.layers[0]?.transform.x).toBe(x);
  });

  it("toggles visibility", () => {
    loadWith([createShapeLayer(layerCtx("a"), "rectangle")]);
    store().toggleLayerVisibility("a");
    expect(store().document?.layers[0]?.hidden).toBe(true);
    store().toggleLayerVisibility("a");
    expect(store().document?.layers[0]?.hidden).toBe(false);
  });
});

describe("clipboard", () => {
  it("copies and pastes with new ids", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().selectLayer("a");
    store().copySelection();
    store().paste();

    const layers = store().document!.layers;
    expect(layers).toHaveLength(2);
    expect(layers[1]!.id).not.toBe("a");
    expect(store().selectedLayerIds).toEqual([layers[1]!.id]);
  });

  it("cuts by copying then deleting", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().selectLayer("a");
    store().cutSelection();
    expect(store().document?.layers).toHaveLength(0);

    store().paste();
    expect(store().document?.layers).toHaveLength(1);
  });

  it("pasting an empty clipboard does nothing", () => {
    loadWith();
    store().paste();
    expect(store().document?.layers).toHaveLength(0);
  });
});

describe("duplication and ordering", () => {
  it("duplicates the selection and selects the copies", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    store().selectLayer("a");
    store().duplicateSelectedLayers();

    expect(store().document?.layers).toHaveLength(2);
    expect(store().selectedLayerIds[0]).not.toBe("a");
  });

  it("brings a layer to the front", () => {
    loadWith([
      createShapeLayer(layerCtx("a", 0), "rectangle"),
      createShapeLayer(layerCtx("b", 1), "circle"),
    ]);
    store().selectLayer("a");
    store().reorderSelectedLayers("front");

    const byZ = [...store().document!.layers].sort((x, y) => x.zIndex - y.zIndex);
    expect(byZ.map((l) => l.id)).toEqual(["b", "a"]);
  });
});

describe("playback", () => {
  it("clamps the playhead to the project duration", () => {
    loadWith();
    store().setCurrentTime(99);
    expect(store().currentTime).toBe(10);
    store().setCurrentTime(-5);
    expect(store().currentTime).toBe(0);
  });

  it("restarts from zero when play is pressed at the end", () => {
    loadWith();
    store().setCurrentTime(10);
    store().play();
    expect(store().currentTime).toBe(0);
    expect(store().isPlaying).toBe(true);
  });

  it("toggles play and pause", () => {
    loadWith();
    store().togglePlay();
    expect(store().isPlaying).toBe(true);
    store().togglePlay();
    expect(store().isPlaying).toBe(false);
  });
});

describe("canvas duration", () => {
  it("refits clips that would fall outside a shortened project", () => {
    loadWith([createTextLayer({ ...layerCtx("a"), startTime: 7, duration: 3 }, "heading", "A")]);
    store().setCanvasDuration(5);

    const layer = store().document!.layers[0]!;
    expect(store().document?.canvas.duration).toBe(5);
    expect(layer.startTime + layer.duration).toBeLessThanOrEqual(5);
  });
});

describe("save state", () => {
  it("marks dirty on edit and saved after a successful save", () => {
    loadWith();
    store().addLayer(createTextLayer(layerCtx("a"), "heading", "A"));
    expect(store().saveState).toBe("dirty");

    store().setSaveState("saving");
    store().markSaved(4);
    expect(store().saveState).toBe("saved");
    expect(store().revision).toBe(4);
  });

  it("records an error message when a save fails", () => {
    loadWith();
    store().setSaveState("error", "Network unavailable");
    expect(store().saveState).toBe("error");
    expect(store().saveError).toBe("Network unavailable");
  });

  it("does not dirty the project for a no-op update", () => {
    loadWith([createTextLayer(layerCtx("a"), "heading", "A")]);
    const before = store().dirtyCounter;
    store().updateLayer("missing-id", (l) => l);
    expect(store().dirtyCounter).toBe(before);
  });
});
