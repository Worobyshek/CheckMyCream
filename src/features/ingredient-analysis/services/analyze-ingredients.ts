import { randomUUID } from "node:crypto";

import { ocrExtractionResultSchema } from "@/features/ingredient-analysis/domain";
import {
  ingredientAnalysisResponseSchema,
  type IngredientAnalysisResponse,
} from "@/features/ingredient-analysis/schemas";
import { analyzeIngredientsWithAI } from "@/features/ingredient-analysis/services/ai-analysis";
import { normalizeIngredients } from "@/features/ingredient-analysis/services/normalize-ingredients";
import { extractTextFromImage } from "@/features/ingredient-analysis/services/ocr-extraction";
import { AppError } from "@/lib/errors";

type AnalyzeIngredientsSubmission = {
  image: File | null;
  ingredientsText: string;
};

export async function analyzeIngredientsFromSubmission(
  submission: AnalyzeIngredientsSubmission,
): Promise<IngredientAnalysisResponse> {
  const hasImage = submission.image instanceof File;
  const manualIngredientsText = submission.ingredientsText.trim();

  if (!hasImage && manualIngredientsText.length === 0) {
    throw new AppError({
      code: "missing_input",
      message: "Add an ingredient photo or paste the ingredient list as text.",
      statusCode: 400,
    });
  }

  try {
    const extracted = hasImage
      ? await extractTextFromImage(submission.image as File)
      : ocrExtractionResultSchema.parse({
          rawText: manualIngredientsText,
          cleanedText: manualIngredientsText,
          ingredientsCandidate: manualIngredientsText
            .split(",")
            .map((ingredient) => ingredient.trim())
            .filter(Boolean),
          confidence: 1,
          warnings: [],
          source: "manual_text",
        });
    const normalizationResult = normalizeIngredients(extracted.cleanedText, extracted.confidence);
    const accumulatedWarnings = dedupeWarnings([
      ...extracted.warnings,
      ...normalizationResult.warnings,
    ]);

    const analysis = await analyzeIngredientsWithAI({
      normalizedIngredients: normalizationResult.ingredients,
      extractedText: normalizationResult.normalizedText,
      ocrConfidence: hasImage ? extracted.confidence : null,
      warnings: accumulatedWarnings,
    });

    const overallConfidence = Number(
      applyConfidencePenalty({
        aiConfidence: analysis.confidence,
        ocrConfidence: hasImage ? extracted.confidence : null,
      }).toFixed(2),
    );
    const finalWarnings = dedupeWarnings([...accumulatedWarnings, ...analysis.warnings]);
    const lowConfidence = overallConfidence < 0.7;

    const result: IngredientAnalysisResponse = {
      requestId: randomUUID(),
      source: hasImage ? "image" : "manual_text",
      extractedText: normalizationResult.normalizedText,
      extraction: {
        source: hasImage ? "image" : "manual_text",
        rawText: extracted.rawText,
        cleanedText: extracted.cleanedText,
        ingredientsCandidate: extracted.ingredientsCandidate,
        ocrConfidence: hasImage ? extracted.confidence : null,
        extractionWarnings: accumulatedWarnings,
      },
      normalization: {
        ...normalizationResult,
        warnings: accumulatedWarnings,
      },
      normalizedIngredients: normalizationResult.ingredients,
      analysis: {
        ...analysis,
        confidence: overallConfidence,
        warnings: finalWarnings,
      },
      warnings: finalWarnings,
      confidence: {
        extraction: hasImage ? extracted.confidence : null,
        analysis: analysis.confidence,
        overall: overallConfidence,
        lowConfidence,
      },
      ui: {
        shouldDisplayLowConfidenceWarning: lowConfidence,
        shouldHighlightWarnings: finalWarnings.length > 0,
      },
      disclaimers: buildDisclaimers(hasImage, extracted.confidence),
    };

    return ingredientAnalysisResponseSchema.parse(result);
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[analyze-ingredients][pipeline] failed with AppError", {
        stage: "analyze-ingredients",
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
      });
    } else {
      console.error("[analyze-ingredients][pipeline] failed", {
        stage: "analyze-ingredients",
        code: "internal_error",
        statusCode: 500,
        message: "The analysis pipeline could not complete the request.",
      });
    }

    throw error;
  }
}

function applyConfidencePenalty({
  aiConfidence,
  ocrConfidence,
}: {
  aiConfidence: number;
  ocrConfidence: number | null;
}): number {
  if (ocrConfidence === null) {
    return aiConfidence;
  }

  const adjustedConfidence = aiConfidence * (0.55 + ocrConfidence * 0.45);
  return Math.max(0, Math.min(1, adjustedConfidence));
}

function buildDisclaimers(hasImage: boolean, ocrConfidence: number): string[] {
  const disclaimers = [
    "This result is informational only and is not a medical assessment.",
    "The review does not infer exact ingredient concentrations unless the product explicitly provides them.",
    "Potential concerns are described cautiously and do not mean the product is definitely harmful for you.",
  ];

  if (hasImage && ocrConfidence < 0.75) {
    disclaimers.push(
      "OCR quality is below the desired threshold, so some ingredients may have been recognized inaccurately.",
    );
  }

  return disclaimers;
}

function dedupeWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const warning of warnings) {
    const normalizedWarning = warning.trim();

    if (normalizedWarning.length === 0 || seen.has(normalizedWarning)) {
      continue;
    }

    seen.add(normalizedWarning);
    deduped.push(normalizedWarning);
  }

  return deduped;
}
