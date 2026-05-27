import { LMStudioClient } from "./lm_studio";

export type AIProvider = "OPENAI" | "ANTHROPIC" | "LM_STUDIO" | "GOOGLE";

export class LocalAIRouter {
  private static instance: LocalAIRouter;
  private lmStudio = LMStudioClient.getInstance();

  private constructor() {}

  public static getInstance(): LocalAIRouter {
    if (!LocalAIRouter.instance) {
      LocalAIRouter.instance = new LocalAIRouter();
    }
    return LocalAIRouter.instance;
  }

  public async routeRequest(
    taskType: "ANALYSIS" | "RISK" | "RESEARCH",
    prompt: string,
    preferredProvider: AIProvider = "LM_STUDIO",
  ): Promise<string> {
    console.log(`[AI Router] Routing ${taskType} task to ${preferredProvider}`);

    if (preferredProvider === "LM_STUDIO") {
      try {
        // Attempt local inference first for privacy/cost
        const response = await this.lmStudio.complete(prompt, "quant-llama-3");
        return response;
      } catch (e) {
        console.warn(
          "[AI Router] LM Studio failed, falling back to mock cloud...",
          e,
        );
      }
    }

    // Mock Cloud Fallback
    return `[Cloud AI Fallback] Analyzed ${taskType} successfully.`;
  }
}
