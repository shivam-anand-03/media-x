import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { envs } from "../configs/envs.config";
import { logger } from "../helper/logger";

export class OpenAIService {
  private static instance: OpenAIService;
  private readonly llm: ChatOpenAI;

  private constructor() {
    this.llm = new ChatOpenAI({
      apiKey: envs.OPEN_AI_API_KEY || "placeholder",
      model: "gpt-4o-mini",
      temperature: 0.7,
    });
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  public async generateResponse(
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    try {
      const messages = [];
      if (systemPrompt) {
        messages.push(new SystemMessage(systemPrompt));
      }
      messages.push(new HumanMessage(prompt));

      const response = await this.llm.invoke(messages);
      return String(response.content);
    } catch (error) {
      logger.error("OpenAI generation failed", { error, prompt });
      throw error;
    }
  }
}

export const openAIService = OpenAIService.getInstance();
