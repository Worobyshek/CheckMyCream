import { z } from "zod";

export const extractionSourceSchema = z.enum(["image", "manual_text"]);
export type ExtractionSource = z.infer<typeof extractionSourceSchema>;

export const productStatusSchema = z.enum([
  "Хороший",
  "Очень хороший",
  "Средний",
  "Нормальный",
  "Нейтральный",
  "Потенциально опасный",
  "Есть риски",
]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const ocrExtractionResultSchema = z.object({
  rawText: z.string().min(1),
  cleanedText: z.string().min(1),
  ingredientsCandidate: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  source: extractionSourceSchema,
});
export type OCRExtractionResult = z.infer<typeof ocrExtractionResultSchema>;

export const normalizedIngredientSchema = z.object({
  raw: z.string().min(1),
  normalized: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type NormalizedIngredient = z.infer<typeof normalizedIngredientSchema>;

export const normalizationDelimiterSchema = z.enum(["comma", "semicolon", "newline", "bullet", "unknown"]);
export type NormalizationDelimiter = z.infer<typeof normalizationDelimiterSchema>;

export const normalizationQualityFlagSchema = z.enum([
  "low_ingredient_count",
  "high_noise",
  "contains_unusual_symbols",
  "long_unbroken_text",
  "duplicate_heavy",
]);
export type NormalizationQualityFlag = z.infer<typeof normalizationQualityFlagSchema>;

export const ingredientNormalizationResultSchema = z.object({
  normalizedText: z.string().min(1),
  ingredients: z.array(normalizedIngredientSchema).min(1),
  detectedDelimiters: z.array(normalizationDelimiterSchema),
  qualityFlags: z.array(normalizationQualityFlagSchema),
  warnings: z.array(z.string()),
});
export type IngredientNormalizationResult = z.infer<typeof ingredientNormalizationResultSchema>;

export const aiIngredientAssessmentSchema = z.object({
  name: z.string().min(1),
  reason: z.string().min(1),
});
export type AIIngredientAssessment = z.infer<typeof aiIngredientAssessmentSchema>;

export const aiAnalysisResultSchema = z.object({
  productStatus: productStatusSchema,
  suitableFor: z.string().min(1),
  summary: z.string().min(1),
  beneficial: z.array(aiIngredientAssessmentSchema),
  caution: z.array(aiIngredientAssessmentSchema),
  neutral: z.array(aiIngredientAssessmentSchema),
  unknown: z.array(aiIngredientAssessmentSchema),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  assumptions: z.array(z.string()),
  disclaimer: z.string().min(1),
});
export type AIAnalysisResult = z.infer<typeof aiAnalysisResultSchema>;

export const extractionMetadataSchema = z.object({
  source: extractionSourceSchema,
  rawText: z.string().min(1),
  cleanedText: z.string().min(1),
  ingredientsCandidate: z.array(z.string().min(1)).min(1),
  ocrConfidence: z.number().min(0).max(1).nullable(),
  extractionWarnings: z.array(z.string()),
});
export type ExtractionMetadata = z.infer<typeof extractionMetadataSchema>;

export const analysisConfidenceSchema = z.object({
  extraction: z.number().min(0).max(1).nullable(),
  analysis: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
  lowConfidence: z.boolean(),
});
export type AnalysisConfidence = z.infer<typeof analysisConfidenceSchema>;

export const analysisUISignalsSchema = z.object({
  shouldDisplayLowConfidenceWarning: z.boolean(),
  shouldHighlightWarnings: z.boolean(),
});
export type AnalysisUISignals = z.infer<typeof analysisUISignalsSchema>;
