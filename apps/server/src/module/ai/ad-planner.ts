import {
  advertisementPlanSchema,
  type AdvertisementPlan,
  type GenerateAdvertisementInput,
} from "@workspace/motion";
import { envs } from "@/common/configs/envs.config";
import { logger } from "@/common/helper/logger";

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
  plan(input: GenerateAdvertisementInput): Promise<AdvertisementPlan>;
}

const STYLE_PALETTES: Record<string, string[]> = {
  modern: ["#7c3aed", "#ec4899", "#ffffff"],
  bold: ["#facc15", "#ef4444", "#0a0a0a"],
  minimal: ["#fafafa", "#a3a3a3", "#0a0a0a"],
  playful: ["#22d3ee", "#f472b6", "#fde047"],
  elegant: ["#d4af37", "#1c1917", "#fafaf9"],
  technical: ["#38bdf8", "#6366f1", "#0f172a"],
};

const SYSTEM_PROMPT = `You are a senior advertising copywriter who writes short-form video adverts for students.
Return ONLY a JSON object, no prose and no markdown fences, matching exactly:
{
  "headline": string (max 40 chars, punchy, the single strongest message),
  "subheadline": string (max 80 chars, optional supporting line),
  "scenes": [ { "title": string (max 50 chars), "body": string (max 120 chars, optional), "caption": string (max 40 chars, optional, ALL CAPS label), "icon": string (optional) } ],
  "cta": string (max 25 chars, an action e.g. "Register Now"),
  "palette": [ "#rrggbb", ... ] (2-4 colours that work on a dark background),
  "backgroundStyle": "dark" | "light" | "gradient"
}
Rules: produce between 2 and 4 scenes. Keep every string within its limit. Never include markdown.
Choose "icon" only from this list: sparkles, star, heart, zap, flame, award, crown, gift, rocket, trophy, target, bell, tag, percent, shopping-bag, shopping-cart, calendar, clock, map-pin, phone, mail, globe, users, user, check, check-circle, arrow-right, play, music, camera, video, code, cpu, database, wifi, smartphone, laptop, headphones, coffee, utensils, pizza, graduation-cap, book-open, lightbulb, megaphone, thumbs-up, quote.`;

/**
 * The LLM-backed planner. Its output is parsed through `advertisementPlanSchema`
 * before being returned — a model that hallucinates a 400-character headline or
 * an unknown field is rejected here, never downstream.
 */
class OpenAiAdPlanner implements AdPlanner {
  readonly name = "openai";

  async plan(input: GenerateAdvertisementInput): Promise<AdvertisementPlan> {
    const { openAIService } = await import("../../common/services/open-ai.service.js");

    const userPrompt = [
      `Product or event: ${input.subject}`,
      `Details: ${input.description}`,
      `Visual style: ${input.style}`,
      `Target length: ${input.duration} seconds`,
      input.palette?.length ? `Preferred colours: ${input.palette.join(", ")}` : "",
      `Aim for ${input.duration <= 8 ? 2 : input.duration <= 14 ? 3 : 4} scenes.`,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await openAIService.generateResponse(userPrompt, SYSTEM_PROMPT);
    return advertisementPlanSchema.parse(extractJson(raw));
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

  async plan(input: GenerateAdvertisementInput): Promise<AdvertisementPlan> {
    const sentences = input.description
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const sceneCount = input.duration <= 8 ? 2 : input.duration <= 14 ? 3 : 4;
    const palette = input.palette?.length
      ? input.palette.filter((c) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c))
      : (STYLE_PALETTES[input.style] ?? STYLE_PALETTES.modern!);

    const icons = ["sparkles", "zap", "star", "trophy"];

    const scenes = Array.from({ length: sceneCount }, (_, i) => {
      const body = sentences[i] ?? sentences[sentences.length - 1];
      return {
        title: i === 0 ? truncate(input.subject, 50) : truncate(body ?? input.subject, 50),
        body: i === 0 ? truncate(sentences[0] ?? input.description, 120) : truncate(sentences[i + 1] ?? "", 120) || undefined,
        caption: i === 0 ? truncate(input.subject.toUpperCase(), 40) : undefined,
        icon: icons[i % icons.length],
      };
    });

    return advertisementPlanSchema.parse({
      headline: truncate(input.subject, 40),
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

/** Models sometimes wrap JSON in prose or fences; pull the object out. */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Plans with the configured provider and falls back to the heuristic planner
 * on any failure. A student without an OpenAI key still gets a working
 * advertisement instead of a dead button.
 */
export async function planAdvertisement(
  input: GenerateAdvertisementInput,
): Promise<{ plan: AdvertisementPlan; source: string }> {
  const fallback = new HeuristicAdPlanner();

  if (!envs.OPEN_AI_API_KEY || envs.OPEN_AI_API_KEY.startsWith("your_")) {
    return { plan: await fallback.plan(input), source: fallback.name };
  }

  const planner = new OpenAiAdPlanner();
  try {
    return { plan: await planner.plan(input), source: planner.name };
  } catch (error) {
    logger.warn("AI planner failed; using the deterministic planner instead", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { plan: await fallback.plan(input), source: fallback.name };
  }
}
