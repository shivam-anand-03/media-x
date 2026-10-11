import OpenAI from "openai";
import { envs } from "../configs/envs.config";
import { logger } from "../helper/logger";

/** True when a real-looking OpenAI key is configured. */
export function hasOpenAiKey(): boolean {
  const key = envs.OPEN_AI_API_KEY?.trim();
  return Boolean(key) && !key.startsWith("your_") && key !== "placeholder";
}

export class OpenAIService {
  private static instance: OpenAIService;
  private readonly client: OpenAI;

  private constructor() {
    this.client = new OpenAI({
      apiKey: envs.OPEN_AI_API_KEY?.trim() || "placeholder",
      timeout: 45_000,
      maxRetries: 1,
    });
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Asks the model for a single JSON object. JSON mode guarantees the reply
   * parses; the caller still validates its shape.
   */
  public async generateJson(prompt: string, systemPrompt: string, imageDataUrls: string[] = []): Promise<unknown> {
    try {
      // With images attached the user turn becomes multimodal; every current
      // OpenAI chat model that supports JSON mode also accepts images.
      const userContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"] = imageDataUrls.length
        ? [
            { type: "text", text: prompt },
            ...imageDataUrls.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "low" as const } })),
          ]
        : prompt;
      const completion = await this.client.chat.completions.create({
        model: envs.AI_MODEL,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("The model returned an empty response");
      return JSON.parse(content);
    } catch (error) {
      logger.error("OpenAI generation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const openAIService = OpenAIService.getInstance();
