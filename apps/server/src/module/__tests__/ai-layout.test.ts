import { describe, expect, it } from "vitest";
import { advertisementPlanSchema, type AdvertisementPlan, type CanvasConfig, type Layer } from "@workspace/motion";
import { compilePlanToDocument, planVideoLoop } from "../ai/plan-compiler";
import { measureLine, wrapBalanced, wrapText } from "../ai/text-layout";

/**
 * Generated layouts must never overlap: two content layers that are on screen
 * at the same time may not share any vertical space, and every content layer
 * must sit inside the canvas. Checked against the longest copy the plan
 * schema allows, on every canvas shape.
 */

const CANVASES: Record<string, CanvasConfig> = {
  reel: { width: 1080, height: 1920, fps: 30, duration: 10 },
  square: { width: 1080, height: 1080, fps: 30, duration: 10 },
  wide: { width: 1920, height: 1080, fps: 30, duration: 15 },
  shortest: { width: 1080, height: 1920, fps: 30, duration: 3 },
  longest: { width: 1080, height: 1920, fps: 30, duration: 60 },
};

const fill = (max: number, word: string) => {
  let out = "";
  while ((out ? `${out} ${word}` : word).length <= max) out = out ? `${out} ${word}` : word;
  return out;
};

const PLANS: Record<string, AdvertisementPlan> = {
  maximal: advertisementPlanSchema.parse({
    headline: fill(60, "MAXIMUM"),
    subheadline: fill(90, "Wonderful"),
    scenes: Array.from({ length: 5 }, () => ({
      title: fill(60, "Wonderful"),
      body: fill(140, "Mammoth"),
      caption: fill(50, "WWWWWW"),
      icon: "rocket",
    })),
    cta: fill(30, "WWWW"),
    palette: ["#7c3aed", "#ec4899", "#ffffff"],
    backgroundStyle: "gradient",
  }),
  unbreakable: advertisementPlanSchema.parse({
    headline: "W".repeat(60),
    scenes: [{ title: "M".repeat(60), body: "W".repeat(140) }],
    cta: "W".repeat(30),
    palette: ["#111111", "#eeeeee"],
    backgroundStyle: "light",
  }),
  minimal: advertisementPlanSchema.parse({
    headline: "Go",
    scenes: [{ title: "Now" }],
    cta: "Buy",
    palette: ["#111111", "#eeeeee"],
    backgroundStyle: "dark",
  }),
  typical: advertisementPlanSchema.parse({
    headline: "Tech Fest 2026",
    subheadline: "Three days of hackathons, robotics and talks",
    scenes: [
      { title: "40+ events", body: "Hackathons, robotics, gaming and more.", caption: "WHAT'S ON", icon: "cpu" },
      { title: "₹5 lakh prize pool", body: "Compete with the best student teams in the country.", icon: "trophy" },
      { title: "20 September", caption: "SAVE THE DATE", icon: "calendar" },
    ],
    cta: "Register Now",
    palette: ["#38bdf8", "#6366f1", "#e0f2fe"],
    backgroundStyle: "gradient",
  }),
};

const isContent = (l: Layer) =>
  l.type !== "gradient" && !l.name.startsWith("Progress") && !l.name.startsWith("Background");
const top = (l: Layer) => l.transform.y - l.transform.height / 2;
const bottom = (l: Layer) => l.transform.y + l.transform.height / 2;
const sharesTime = (a: Layer, b: Layer) =>
  a.startTime < b.startTime + b.duration - 1e-6 && b.startTime < a.startTime + a.duration - 1e-6;

describe("AI layout", () => {
  for (const [planName, plan] of Object.entries(PLANS)) {
    for (const [canvasName, canvas] of Object.entries(CANVASES)) {
      it(`${planName} plan on ${canvasName}: no overlapping content, all inside the canvas`, () => {
        const doc = compilePlanToDocument(plan, canvas);
        const content = doc.layers.filter(isContent);

        for (const layer of content) {
          expect(top(layer)).toBeGreaterThanOrEqual(0);
          expect(bottom(layer)).toBeLessThanOrEqual(canvas.height);
          expect(layer.transform.width).toBeLessThanOrEqual(canvas.width);
          expect(layer.startTime + layer.duration).toBeLessThanOrEqual(canvas.duration + 0.001);
        }

        for (let i = 0; i < content.length; i++) {
          for (let j = i + 1; j < content.length; j++) {
            const a = content[i]!;
            const b = content[j]!;
            if (!sharesTime(a, b)) continue;
            const overlap = Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b));
            expect(overlap, `"${a.name}" overlaps "${b.name}"`).toBeLessThanOrEqual(0);
          }
        }
      });
    }
  }

  it("wraps text with explicit breaks that fit the box with slack", () => {
    const doc = compilePlanToDocument(PLANS.maximal!, CANVASES.reel!);
    for (const layer of doc.layers) {
      if (layer.type !== "text") continue;
      const p = layer.properties;
      const box = layer.transform.width - p.paddingX * 2;
      for (const line of p.text.split("\n")) {
        const width = measureLine(line, {
          fontSize: p.fontSize,
          fontWeight: p.fontWeight,
          letterSpacing: p.letterSpacing,
          uppercase: p.textTransform === "uppercase",
        });
        // A font 10% wider than the estimate must still fit on one line.
        expect(width * 1.1, `${layer.name}: "${line}"`).toBeLessThanOrEqual(box);
      }
    }
  });

  it("gives every screen its own time window", () => {
    const doc = compilePlanToDocument(PLANS.typical!, CANVASES.reel!);
    const scenes = [...doc.scenes].sort((a, b) => a.startTime - b.startTime);
    expect(scenes[0]!.startTime).toBe(0);
    for (let i = 1; i < scenes.length; i++) {
      const prev = scenes[i - 1]!;
      expect(scenes[i]!.startTime).toBeCloseTo(prev.startTime + prev.duration, 2);
    }
    const last = scenes[scenes.length - 1]!;
    expect(last.startTime + last.duration).toBeCloseTo(10, 2);
  });

  it("balances wrapped lines", () => {
    const m = { fontSize: 100, fontWeight: 800, letterSpacing: 0 };
    const greedy = wrapText("Tech fest twenty twenty six is here", 1500, m).lines;
    const balanced = wrapBalanced("Tech fest twenty twenty six is here", 1500, m).lines;
    expect(balanced.length).toBe(greedy.length);
    const spread = (ls: string[]) => {
      const ws = ls.map((l) => measureLine(l, m));
      return Math.max(...ws) - Math.min(...ws);
    };
    expect(spread(balanced)).toBeLessThanOrEqual(spread(greedy));
  });

  it("does not mangle short copy", () => {
    const doc = compilePlanToDocument(PLANS.minimal!, CANVASES.square!);
    const texts = doc.layers.filter((l) => l.type === "text").map((l) => (l.type === "text" ? l.properties.text : ""));
    expect(texts).toContain("GO");
    expect(texts).toContain("Now");
    expect(texts).toContain("Buy");
  });


  describe("with user media", () => {
    const media = {
      background: { kind: "image" as const, url: "http://localhost:5030/uploads/media/image/a-photo.jpg", luminance: 0.8 },
      audio: { url: "http://localhost:5030/uploads/media/audio/a-song.mp3", filename: "song.mp3", duration: 45 },
    };

    it("uses the image as a full-bleed background under a contrast overlay", () => {
      const canvas = CANVASES.reel!;
      const doc = compilePlanToDocument(PLANS.typical!, canvas, media);
      const sorted = [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);
      const [bg, overlay] = sorted;

      expect(bg!.type).toBe("image");
      expect(bg!.type === "image" && bg!.properties.src).toBe(media.background.url);
      expect(bg!.startTime).toBe(0);
      expect(bg!.duration).toBe(canvas.duration);
      expect(bg!.transform.width).toBeGreaterThanOrEqual(canvas.width);
      expect(bg!.transform.height).toBeGreaterThanOrEqual(canvas.height);

      expect(overlay!.type).toBe("shape");
      // A bright photo gets a strong overlay so white text stays readable.
      expect(overlay!.transform.opacity).toBeGreaterThanOrEqual(0.55);
      expect(doc.layers.some((l) => l.type === "gradient")).toBe(false);

      // Text is light on a photo even when the plan asked for a light theme.
      const lightPlan = { ...PLANS.typical!, backgroundStyle: "light" as const };
      const lightDoc = compilePlanToDocument(lightPlan, canvas, media);
      const headline = lightDoc.layers.find((l) => l.name.startsWith("Headline"));
      expect(headline?.type === "text" && headline.properties.color).toBe("#ffffff");
    });

    it("lays the audio under the short, trimmed and faded", () => {
      const doc = compilePlanToDocument(PLANS.typical!, CANVASES.reel!, media);
      expect(doc.audioTracks).toHaveLength(1);
      const track = doc.audioTracks[0]!;
      expect(track.src).toBe(media.audio.url);
      expect(track.startTime).toBe(0);
      expect(track.duration).toBe(10);
      expect(track.fadeIn).toBeGreaterThan(0);
      expect(track.fadeOut).toBeGreaterThan(0);

      const short = compilePlanToDocument(PLANS.typical!, CANVASES.reel!, { audio: { ...media.audio, duration: 4 } });
      expect(short.audioTracks[0]!.duration).toBe(4);
    });

    for (const [canvasName, canvas] of Object.entries(CANVASES)) {
      it(`still never overlaps with an image background on ${canvasName}`, () => {
        const doc = compilePlanToDocument(PLANS.maximal!, canvas, media);
        const content = doc.layers.filter(isContent);
        for (let i = 0; i < content.length; i++) {
          for (let j = i + 1; j < content.length; j++) {
            const a = content[i]!;
            const b = content[j]!;
            if (!sharesTime(a, b)) continue;
            expect(Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b))).toBeLessThanOrEqual(0);
          }
        }
      });
    }
  });

  describe("with a background video", () => {
    const video = { kind: "video" as const, url: "http://localhost:5030/uploads/media/video/clip.mp4", luminance: 0.4 };
    const music = { url: "http://localhost:5030/uploads/media/audio/a.mp3", filename: "a.mp3", duration: 30 };
    const videoLayers = (doc: ReturnType<typeof compilePlanToDocument>) =>
      doc.layers.filter((l): l is Extract<Layer, { type: "video" }> => l.type === "video").sort((a, b) => a.startTime - b.startTime);

    it("plays a long clip once, full-bleed, under the overlay", () => {
      const doc = compilePlanToDocument(PLANS.typical!, CANVASES.reel!, { background: { ...video, duration: 30 } });
      const clips = videoLayers(doc);
      expect(clips).toHaveLength(1);
      expect(clips[0]!.startTime).toBe(0);
      expect(clips[0]!.duration).toBe(10);
      expect(clips[0]!.transform.width).toBe(1080);
      const overlay = doc.layers.find((l) => l.name === "Background overlay")!;
      expect(overlay.zIndex).toBeGreaterThan(clips[0]!.zIndex);
    });

    it("loops a short clip with back-to-back copies covering the whole short", () => {
      const doc = compilePlanToDocument(PLANS.typical!, CANVASES.reel!, { background: { ...video, duration: 3 } });
      const clips = videoLayers(doc);
      expect(clips.length).toBe(4);
      let cursor = 0;
      for (const clip of clips) {
        expect(clip.startTime).toBeCloseTo(cursor, 2);
        cursor = clip.startTime + clip.duration;
      }
      expect(cursor).toBeCloseTo(10, 2);
    });

    it("slows a tiny clip rather than stacking dozens of copies", () => {
      const { clips } = planVideoLoop(0.5, 60);
      expect(clips.length).toBeLessThanOrEqual(60);
      expect(clips[0]!.rate).toBe(0.25);
      expect(planVideoLoop(2, 10).clips.every((c) => c.length >= 0.1)).toBe(true);
      expect(planVideoLoop(3.33, 10).clips.every((c) => c.length >= 0.1)).toBe(true);
    });

    it("keeps the clip's own sound only when there is no separate music", () => {
      const own = videoLayers(compilePlanToDocument(PLANS.typical!, CANVASES.reel!, { background: video }))[0]!;
      expect(own.properties.muted).toBe(false);
      expect(own.properties.volume).toBeGreaterThan(0);

      const withMusic = videoLayers(compilePlanToDocument(PLANS.typical!, CANVASES.reel!, { background: video, audio: music }))[0]!;
      expect(withMusic.properties.muted).toBe(true);
    });
  });
});
