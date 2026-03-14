import {
  type AIProviderAdapter,
  type AIProviderRequest,
} from "@/features/ingredient-analysis/adapters/ai-provider";
import { mockAIProvider } from "@/features/ingredient-analysis/adapters/mock-ai-provider";
import { remoteAIProvider } from "@/features/ingredient-analysis/adapters/remote-ai-provider";
import { safeValidateAIAnalysisResult } from "@/features/ingredient-analysis/ai-analysis-result";
import { buildAIAnalysisPrompts } from "@/features/ingredient-analysis/ai-prompt-builder";
import {
  aiAnalysisResultSchema,
  type AIAnalysisResult,
  type NormalizedIngredient,
} from "@/features/ingredient-analysis/domain";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

type AnalyzeIngredientsWithAIParams = {
  normalizedIngredients: NormalizedIngredient[];
  extractedText: string;
  ocrConfidence: number | null;
  warnings: string[];
};

export async function analyzeIngredientsWithAI({
  normalizedIngredients,
  extractedText,
  ocrConfidence,
  warnings,
}: AnalyzeIngredientsWithAIParams): Promise<AIAnalysisResult> {
  if (normalizedIngredients.length === 0) {
    throw new AppError({
      code: "empty_ingredients",
      message: "No ingredients were available for analysis.",
      statusCode: 422,
    });
  }

  const prompts = buildAIAnalysisPrompts({
    extractedText,
    normalizedIngredients,
    ocrConfidence,
    warnings,
  });

  const providerRequest: AIProviderRequest = {
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    input: {
      extractedText,
      ocrConfidence,
      warnings,
      normalizedIngredients: normalizedIngredients.map((ingredient) => ingredient.normalized),
    },
  };

  try {
    const provider = resolveAIProvider();
    const providerResponse = await provider.analyze(providerRequest);
    const parsedResult = safeValidateAIAnalysisResult(providerResponse.rawResult);

    if (parsedResult.success) {
      return parsedResult.data;
    }

    return buildFallbackAIAnalysis({
      normalizedIngredients,
      ocrConfidence,
      warnings: [
        ...warnings,
        "The AI provider returned invalid JSON, so a safe fallback response was used.",
      ],
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      code: "analysis_service_failed",
      message: "The AI analysis service could not complete the request.",
      statusCode: 502,
    });
  }
}

function resolveAIProvider(): AIProviderAdapter {
  const provider = getServerEnv("AI_PROVIDER") ?? "remote";

  switch (provider) {
    case "mock":
      return mockAIProvider;
    case "remote":
      return remoteAIProvider;
    default:
      throw new AppError({
        code: "unsupported_ai_provider",
        message: "The configured AI provider is not supported.",
        statusCode: 503,
      });
  }
}

function buildFallbackAIAnalysis({
  normalizedIngredients,
  ocrConfidence,
  warnings,
}: {
  normalizedIngredients: NormalizedIngredient[];
  ocrConfidence: number | null;
  warnings: string[];
}): AIAnalysisResult {
  const limitedIngredients = normalizedIngredients.slice(0, 5);

  return aiAnalysisResultSchema.parse({
    productStatus: ocrConfidence !== null && ocrConfidence < 0.7 ? "Нейтральный" : "Есть риски",
    suitableFor:
      "Может подойти пользователям без выраженной чувствительности, но для точной рекомендации по типу кожи или волос данных недостаточно.",
    summary:
      "Полностью валидный ответ от AI не был получен, поэтому результат сформирован в осторожном и ограниченном режиме.",
    beneficial: [],
    caution: limitedIngredients.map((ingredient) => ({
      name: ingredient.normalized,
      reason: "Надежное пояснение по этому ингредиенту от AI-провайдера получить не удалось.",
    })),
    neutral: [],
    unknown: [],
    confidence: ocrConfidence === null ? 0.35 : Math.max(0.2, Math.min(0.5, ocrConfidence * 0.6)),
    warnings,
    assumptions: [
      "Этот ответ был сформирован как fallback, потому что результат провайдера не удалось безопасно провалидировать.",
    ],
    disclaimer:
      "Этот анализ носит информационный характер, не является медицинской рекомендацией и не определяет концентрации ингредиентов.",
  });
}
