import { type OCRProviderAdapter } from "@/features/ingredient-analysis/adapters/ocr-provider";
import { getRequiredServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/http";

type OCRSpaceParsedResult = {
  ParsedText?: unknown;
  ErrorMessage?: unknown;
  ErrorDetails?: unknown;
};

type OCRSpaceResponse = {
  ParsedResults?: unknown;
  OCRExitCode?: unknown;
  IsErroredOnProcessing?: unknown;
  ErrorMessage?: unknown;
  ErrorDetails?: unknown;
};

export const remoteOCRProvider: OCRProviderAdapter = {
  async extract(file) {
    const ocrApiUrl = getRequiredServerEnv('OCR_API_URL');
    const ocrApiKey = getRequiredServerEnv('OCR_API_KEY');

    const upstreamFormData = new FormData();
    upstreamFormData.set('file', file);
    upstreamFormData.set('language', 'auto');
    upstreamFormData.set('scale', 'true');
    upstreamFormData.set('OCREngine', '2');
    upstreamFormData.set('isOverlayRequired', 'false');

    const response = await fetchWithTimeout(
      ocrApiUrl,
      {
        method: 'POST',
        headers: {
          apikey: ocrApiKey,
        },
        body: upstreamFormData,
        cache: 'no-store',
      },
      55000,
      new AppError({
        code: 'ocr_timeout',
        message: 'The OCR service took too long to respond. Please try again.',
        statusCode: 504,
      }),
    );

    if (!response.ok) {
      throw new AppError({
        code: "ocr_failed",
        message: "The OCR service could not extract text from the image.",
        statusCode: 502,
      });
    }

    let payload: OCRSpaceResponse;

    try {
      payload = (await response.json()) as OCRSpaceResponse;
    } catch {
      throw new AppError({
        code: "ocr_invalid_json",
        message: "The OCR service returned an unreadable response.",
        statusCode: 502,
      });
    }

    if (payload.IsErroredOnProcessing === true) {
      throw new AppError({
        code: "ocr_failed",
        message: extractProviderErrorMessage(payload.ErrorMessage, payload.ErrorDetails),
        statusCode: 502,
      });
    }

    const parsedResults = Array.isArray(payload.ParsedResults) ? payload.ParsedResults : [];
    const firstParsedResult = parsedResults[0] as OCRSpaceParsedResult | undefined;
    const rawText =
      typeof firstParsedResult?.ParsedText === "string" ? firstParsedResult.ParsedText.trim() : "";
    const cleanedText = normalizeOCRText(rawText);

    if (rawText.length === 0 || cleanedText.length === 0) {
      throw new AppError({
        code: "ocr_empty",
        message: "The OCR service did not return usable text.",
        statusCode: 422,
      });
    }

    const ingredientsCandidate = extractIngredientCandidates(cleanedText);

    if (ingredientsCandidate.length === 0) {
      throw new AppError({
        code: "ocr_empty_candidates",
        message: "The OCR service did not produce ingredient candidates.",
        statusCode: 422,
      });
    }

    const confidence = 0.7;
    const warnings: string[] = [];

    if (confidence < 0.2) {
      throw new AppError({
        code: "ocr_confidence_too_low",
        message: "We could not read the ingredient label confidently enough. Please try a clearer image.",
        statusCode: 422,
      });
    }

    if (confidence < 0.55) {
      warnings.push("OCR confidence is low. Please review the extracted text carefully.");
    }

    if (cleanedText.length < 24 || ingredientsCandidate.length < 2) {
      warnings.push("The extracted OCR text is short. Please verify the recognized ingredients carefully.");
    }

    return {
      rawText,
      cleanedText,
      ingredientsCandidate,
      confidence,
      warnings,
    };
  },
};

function normalizeOCRText(rawText: string): string {
  return rawText.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function extractIngredientCandidates(cleanedText: string): string[] {
  return cleanedText
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractProviderErrorMessage(errorMessage: unknown, errorDetails: unknown): string {
  const parts = [errorMessage, errorDetails]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return parts[0] ?? "The OCR service could not extract text from the image.";
}
