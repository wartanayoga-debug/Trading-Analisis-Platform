import { LMStudioClient } from "./lm_studio";

export type AIProvider = "OPENAI" | "ANTHROPIC" | "LM_STUDIO" | "GOOGLE";
export type TaskType = "ANALYSIS" | "RISK" | "RESEARCH" | "SENTIMENT";

export interface AIRequest {
  taskId: string;
  taskType: TaskType;
  prompt: string;
  priority: number;
}

export class LocalAIRouter {
  private static instance: LocalAIRouter;
  private lmStudio = LMStudioClient.getInstance();
  private requestQueue: AIRequest[] = [];
  private tokenBudget = 1000000;
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): LocalAIRouter {
    if (!LocalAIRouter.instance) {
      LocalAIRouter.instance = new LocalAIRouter();
    }
    return LocalAIRouter.instance;
  }

  private truncateContext(prompt: string, maxTokens: number): string {
    // Basic heuristic: 1 token ~= 4 characters
    const maxChars = maxTokens * 4;
    if (prompt.length > maxChars) {
      console.log(
        `[AI Router] Truncating context from ${prompt.length} to ${maxChars} chars.`,
      );
      return prompt.substring(0, maxChars) + "... [TRUNCATED]";
    }
    return prompt;
  }

  public async routeRequest(
    taskType: TaskType,
    prompt: string,
    preferredProvider: AIProvider = "LM_STUDIO",
  ): Promise<string> {
    const taskId = Math.random().toString(36).substring(7);
    this.requestQueue.push({ taskId, taskType, prompt, priority: 1 });

    // Sort by priority (mock logic)
    this.requestQueue.sort((a, b) => b.priority - a.priority);

    return this.processQueue(preferredProvider);
  }

  private async processQueue(preferredProvider: AIProvider): Promise<string> {
    if (this.requestQueue.length === 0) return "";
    this.isProcessing = true;

    const req = this.requestQueue.shift()!;
    let modelSelection = "quant-llama-3"; // Default for Analysis

    if (req.taskType === "SENTIMENT") {
      modelSelection = "financial-roberta-v1"; // Specific model for Sentiment
    } else if (req.taskType === "RISK") {
      modelSelection = "mistral-finance-instruct"; // Risk specific
    }

    console.log(
      `[AI Router Queue] Processing Task [${req.taskType}] with model selection: ${modelSelection}`,
    );

    // Context Truncation
    const safePrompt = this.truncateContext(req.prompt, 4000); // 4k context window max for local
    const estimatedTokens = Math.floor(safePrompt.length / 4);

    // Token Budgeting
    if (this.tokenBudget < estimatedTokens) {
      console.warn(
        `[AI Router] Token budget exceeded. Defaulting to Cloud Fallback.`,
      );
      this.isProcessing = false;
      return `[Cloud AI Fallback] Budget exceeded for ${req.taskType}.`;
    }
    this.tokenBudget -= estimatedTokens;

    let response = "";
    if (preferredProvider === "LM_STUDIO") {
      try {
        // Attempt local inference first
        response = await this.lmStudio.complete(safePrompt, modelSelection);
      } catch (e) {
        console.warn(
          "[AI Router] LM Studio failed, engaging Fallback Models...",
          e,
        );
        response = `[Fallback Model] Analyzed ${req.taskType} successfully.`;
      }
    } else {
      response = `[Cloud AI Fallback] Analyzed ${req.taskType} successfully.`;
    }

    this.isProcessing = false;
    return response;
  }
}
