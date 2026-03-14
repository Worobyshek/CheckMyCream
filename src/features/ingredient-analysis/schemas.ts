import { z } from "zod";

import {
  analysisConfidenceSchema,
  analysisUISignalsSchema,
  aiAnalysisResultSchema,
  aiIngredientAssessmentSchema,
  extractionMetadataSchema,
  ingredientNormalizationResultSchema,
  normalizedIngredientSchema,
  ocrExtractionResultSchema,
} from "@/features/ingredient-analysis/domain";

export {
  aiAnalysisResultSchema as aiAnalysisSchema,
  aiIngredientAssessmentSchema,
  extractionMetadataSchema,
  normalizedIngredientSchema,
  ocrExtractionResultSchema,
} from "@/features/ingredient-analysis/domain";

export const ingredientAnalysisResponseSchema = z.object({
  requestId: z.string().min(1),
  source: z.enum(["image", "manual_text"]),
  extractedText: z.string().min(1),
  extraction: extractionMetadataSchema,
  normalization: ingredientNormalizationResultSchema,
  normalizedIngredients: z.array(normalizedIngredientSchema).min(1),
  analysis: aiAnalysisResultSchema,
  warnings: z.array(z.string()),
  confidence: analysisConfidenceSchema,
  ui: analysisUISignalsSchema,
  disclaimers: z.array(z.string()).min(1),
});

export const aiUpstreamPayloadSchema = z.object({
  result: aiAnalysisResultSchema,
});

export const ocrExtractionResponseSchema = z.object({
  rawText: z.string().min(1),
  cleanedText: z.string().min(1),
  ingredientsCandidate: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type IngredientAnalysisResponse = z.infer<typeof ingredientAnalysisResponseSchema>;
export type AIAnalysis = z.infer<typeof aiAnalysisResultSchema>;
export type NormalizedIngredient = z.infer<typeof normalizedIngredientSchema>;
export type OCRExtractionResponse = z.infer<typeof ocrExtractionResponseSchema>;
export type APIErrorResponse = z.infer<typeof apiErrorResponseSchema>;
