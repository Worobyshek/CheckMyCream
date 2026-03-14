import { z } from "zod";

import {
  aiAnalysisResultSchema,
  type AIAnalysisResult,
} from "@/features/ingredient-analysis/domain";

export function validateAIAnalysisResult(payload: unknown): AIAnalysisResult {
  return aiAnalysisResultSchema.parse(payload);
}

export function safeValidateAIAnalysisResult(payload: unknown):
  | { success: true; data: AIAnalysisResult }
  | { success: false; error: z.ZodError<AIAnalysisResult> } {
  const parsed = aiAnalysisResultSchema.safeParse(payload);

  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    };
  }

  return {
    success: false,
    error: parsed.error,
  };
}
