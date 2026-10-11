import {
  advertisementPlanSchema,
  isKnownIcon,
  type AdvertisementPlan,
  type GenerateAdvertisementInput,
} from "@workspace/motion";
import { logger } from "@/common/helper/logger";
import type { GenerationMedia } from "./generation-media";

/**
 * Advertisement planning, behind an interface (§36).
 *
 * The editor never talks to a model. It asks for a *plan* — a short, tightly
 * bounded content outline — which is then compiled into a project document by
 * deterministic code. Swapping providers, or adding one later, means adding a
 * `AdPlanner` implementation and nothing else; no AI logic leaks into the
 * editor or the schema.
 */
export interface AdPlanner {
  readonly name: string;
  plan(input: GenerateAdvertisementInput, media?: GenerationMedia): Promise<AdvertisementPlan>;
}

const STYLE_PALETTES: Record<string, string[]> = {
  modern: ["#7c3aed", "#ec4899", "#ffffff"],
  bold: ["#facc15", "#ef4444", "#0a0a0a"],
  minimal: ["#fafafa", "#a3a3a3", "#0a0a0a"],
  playful: ["#22d3ee", "#f472b6", "#fde047"],
  elegant: ["#d4af37", "#1c1917", "#fafaf9"],
  technical: ["#38bdf8", "#6366f1", "#0f172a"],
};

const ICON_CHOICES =
  "sparkles, star, heart, zap, flame, award, crown, gift, rocket, trophy, target, bell, tag, percent, shopping-bag, shopping-cart, calendar, clock, map-pin, phone, mail, globe, users, user, check, check-circle, arrow-right, play, music, camera, video, code, cpu, database, wifi, smartphone, laptop, headphones, coffee, utensils, pizza, graduation-cap, book-open, lightbulb, megaphone, thumbs-up, quote";

const SYSTEM_PROMPT = `You are a senior creative director who writes scroll-stopping short-form video adverts (Reels, Shorts, TikTok).
The user gives you an instruction. Turn it into a tight on-screen script.
Return ONLY a JSON object matching exactly:
{
  "headline": string (max 32 chars — the hook, readable in one glance),
  "subheadline": string (max 70 chars, optional supporting line),
  "scenes": [ { "title": string (max 38 chars), "body": string (max 90 chars, optional), "caption": string (max 24 chars, optional, ALL CAPS label), "icon": string (optional) } ],
  "cta": string (max 22 chars, an action e.g. "Register Now"),
  "palette": [ "#rrggbb", ... ] (3-4 colours: two vivid accents that pop on a dark background, then one light highlight),
  "backgroundStyle": "dark" | "light" | "gradient"
}
Writing rules:
- On-screen text, not narration: short, concrete, no filler, no hashtags, no emoji.
- Each scene makes ONE point. Use real facts, numbers, dates and names from the instruction; never invent prices or dates.
- Write in the same language as the instruction.
- Keep every string within its limit.
- Choose "icon" only from: ${ICON_CHOICES}.
If images are attached they show the full-screen background — a photo, or frames from a background video:
- Look at them. Use what they show (product, place, people, food, action, mood) to make the copy specific.
- Pick palette accents that harmonise with the background and stay readable as white-text accents over it.
- Text sits over the background, so prefer fewer, shorter lines; you may omit "icon" when the visuals already say it.`;

/**
 * The LLM-backed planner. Its output is parsed through `advertisementPlanSchema`
 * before being returned — a model that hallucinates a 400-character headline or
 * an unknown field is rejected here, never downstream.
 */
class OpenAiAdPlanner implements AdPlanner {
  readonly name = "openai";

  async plan(input: GenerateAdvertisementInput, media?: GenerationMedia): Promise<AdvertisementPlan> {
    const { openAIService } = await import("../../common/services/open-ai.service.js");
    const background = media?.background;

    const userPrompt = [
      `Instruction: ${input.description}`,
      input.subject ? `Brand / title: ${input.subject}` : "",
      `Visual style: ${input.style}`,
      `Video length: ${input.duration} seconds`,
      input.palette?.length ? `Brand colours to build around: ${input.palette.join(", ")}` : "",
      background
        ? background.kind === "video"
          ? `Background video attached (${background.filename}${background.duration ? `, ${Math.round(background.duration)}s` : ""}); ${background.visionDataUrls.length} frames from it are attached. Dominant colours: ${background.colors.join(", ") || "unknown"}.`
          : `Background image attached (${background.filename}). Dominant colours: ${background.colors.join(", ") || "unknown"}.`
        : "",
      media?.audio ? `A music track (${media.audio.filename}) plays underneath; match its likely energy.` : "",
      `Write exactly ${sceneCountFor(input.duration)} scenes.`,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await openAIService.generateJson(userPrompt, SYSTEM_PROMPT, background?.visionDataUrls);
    return advertisementPlanSchema.parse(sanitizePlan(raw));
  }
}

/**
 * Deterministic fallback used when no API key is configured, or when the model
 * call fails.
 *
 * This is not a stub: it writes a real, structured advert from the user's own
 * words, so "Generate with AI" always produces an editable project rather than
 * an error. It also makes the whole generate → compile → editor path testable
 * without a network call.
 */
export class HeuristicAdPlanner implements AdPlanner {
  readonly name = "heuristic";

  async plan(input: GenerateAdvertisementInput, media?: GenerationMedia): Promise<AdvertisementPlan> {
    const sentences = input.description
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const subject = input.subject || deriveSubject(sentences[0] ?? input.description);
    const sceneCount = sceneCountFor(input.duration);
    const imageAccents = media?.background?.colors.slice(1) ?? [];
    const palette = input.palette?.length
      ? input.palette.filter((c) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c))
      : imageAccents.length >= 2
        ? [...imageAccents, "#ffffff"]
        : (STYLE_PALETTES[input.style] ?? STYLE_PALETTES.modern!);

    const icons = ["sparkles", "zap", "star", "trophy"];

    const scenes = Array.from({ length: sceneCount }, (_, i) => {
      const body = sentences[i] ?? sentences[sentences.length - 1];
      return {
        title: i === 0 ? truncate(subject, 50) : truncate(body ?? subject, 50),
        body: i === 0 ? truncate(sentences[0] ?? input.description, 120) : truncate(sentences[i + 1] ?? "", 120) || undefined,
        caption: i === 0 ? truncate(subject.toUpperCase(), 24) : undefined,
        icon: icons[i % icons.length],
      };
    });

    return advertisementPlanSchema.parse({
      headline: truncate(subject, 40),
      subheadline: truncate(sentences[0] ?? input.description, 80),
      scenes,
      cta: "Learn More",
      palette: palette.length >= 2 ? palette.slice(0, 4) : ["#7c3aed", "#ec4899"],
      backgroundStyle: input.style === "minimal" ? "light" : "gradient",
    });
  }
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  // Prefer breaking on a word boundary so the result doesn't read as truncated.
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

const sceneCountFor = (duration: number) => (duration <= 8 ? 2 : duration <= 14 ? 3 : duration <= 22 ? 4 : 5);

/** "Annual tech fest for students…" → "Annual tech fest for students". */
function deriveSubject(sentence: string): string {
  const words = sentence.replace(/[.!?]+$/, "").split(/\s+/).filter(Boolean);
  return truncate(words.slice(0, 6).join(" "), 40) || "Something New";
}

/**
 * Fits model output to the plan schema's limits instead of rejecting it.
 * A model that writes a 35-character headline against a 32 limit should not
 * cost the user their whole generation. Anything structurally wrong still
 * fails the schema parse that follows.
 */
function sanitizePlan(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  const str = (value: unknown, max: number) =>
    typeof value === "string" && value.trim() ? truncate(value, max) : undefined;

  const scenes = Array.isArray(r.scenes) ? r.scenes.slice(0, 5) : [];
  const palette = Array.isArray(r.palette)
    ? r.palette.filter((c): c is string => typeof c === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim())).map((c) => c.trim())
    : [];

  return {
    headline: str(r.headline, 60),
    subheadline: str(r.subheadline, 90),
    scenes: scenes
      .filter((scene): scene is Record<string, unknown> => typeof scene === "object" && scene !== null)
      .map((scene) => ({
        title: str(scene.title, 60) ?? str(scene.body, 60),
        body: str(scene.body, 140),
        caption: str(scene.caption, 50)?.toUpperCase(),
        icon: typeof scene.icon === "string" && isKnownIcon(scene.icon) ? scene.icon : undefined,
      })),
    cta: str(r.cta, 30) ?? "Learn More",
    palette: palette.length >= 2 ? palette.slice(0, 5) : ["#7c3aed", "#ec4899", "#ffffff"],
    backgroundStyle: ["dark", "light", "gradient"].includes(r.backgroundStyle as string) ? r.backgroundStyle : "gradient",
  };
}

/**
 * Plans with the configured provider and falls back to the heuristic planner
 * on any failure. A student without an OpenAI key still gets a working
 * advertisement instead of a dead button.
 */
export async function planAdvertisement(
  input: GenerateAdvertisementInput,
  media?: GenerationMedia,
): Promise<{ plan: AdvertisementPlan; source: string; warning?: string }> {
  const { hasOpenAiKey } = await import("../../common/services/open-ai.service.js");
  const fallback = new HeuristicAdPlanner();

  if (!hasOpenAiKey()) {
    return { plan: await fallback.plan(input, media), source: fallback.name };
  }

  const planner = new OpenAiAdPlanner();
  try {
    return { plan: await planner.plan(input, media), source: planner.name };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("AI planner failed; using the deterministic planner instead", { error: message });
    return {
      plan: await fallback.plan(input, media),
      source: fallback.name,
      // Surfaced so a wrong key or exhausted quota isn't silently hidden.
      warning: `OpenAI request failed (${message.slice(0, 160)}). Used the built-in planner instead.`,
    };
  }
}
