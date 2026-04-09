import { tmpdir } from "node:os";
import { join } from "node:path";

import { PSM, createWorker } from "tesseract.js";

import { type OCRProviderAdapter } from "@/features/ingredient-analysis/adapters/ocr-provider";
import {
  extractIngredientCandidates,
  normalizeOCRText,
} from "@/features/ingredient-analysis/services/ocr-postprocessing";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const defaultOCRLanguage = "eng";
const defaultMaxRecognitionTimeMs = 60_000;

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

export const tesseractOCRProvider: OCRProviderAdapter = {
  async extract(file) {
    const worker = await getWorker();
    const buffer = Buffer.from(await file.arrayBuffer());

    let recognitionResult: Awaited<ReturnType<typeof worker.recognize>>;

    try {
      recognitionResult = await recognizeWithTimeout(
        worker.recognize(buffer, { rotateAuto: true }),
        defaultMaxRecognitionTimeMs,
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      workerPromise = null;

      throw new AppError({
        code: "ocr_failed",
        message: "The local OCR service could not extract text from the image.",
        statusCode: 502,
      });
    }

    const rawText = typeof recognitionResult.data.text === "string"
      ? recognitionResult.data.text.trim()
      : "";
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

    const confidence = normalizeConfidence(recognitionResult.data.confidence);
    const warnings = buildWarnings(cleanedText, ingredientsCandidate, confidence);

    return {
      rawText,
      cleanedText,
      ingredientsCandidate,
      confidence,
      warnings,
    };
  },
};

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createConfiguredWorker().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }

  return workerPromise;
}

async function createConfiguredWorker() {
  const language = getServerEnv("OCR_LANGUAGE") ?? defaultOCRLanguage;
  const langPath = getServerEnv("OCR_TESSDATA_PATH");

  let worker: Awaited<ReturnType<typeof createWorker>>;

  try {
    worker = await createWorker(language, 1, {
      ...(langPath ? { langPath } : {}),
      cachePath: join(tmpdir(), "check-my-cream-tesseract"),
    });
  } catch {
    throw new AppError({
      code: "ocr_failed",
      message: "The local OCR worker could not be initialized on the server.",
      statusCode: 502,
    });
  }

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.,()%/+[]:; \n",
  });

  return worker;
}

async function recognizeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new AppError({
              code: "ocr_timeout",
              message: "The local OCR service took too long to respond. Please try again.",
              statusCode: 504,
            }),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.35;
  }

  return Math.max(0, Math.min(1, value / 100));
}

function buildWarnings(cleanedText: string, ingredientsCandidate: string[], confidence: number): string[] {
  const warnings: string[] = [];

  if (confidence < 0.72) {
    warnings.push("OCR confidence is lower than ideal. Please review the extracted text carefully.");
  }

  if (confidence < 0.5) {
    warnings.push("The label photo may be blurry, low-contrast, or too dense for highly accurate OCR.");
  }

  if (cleanedText.length < 24 || ingredientsCandidate.length < 2) {
    warnings.push("The extracted OCR text is short. Please verify the recognized ingredients carefully.");
  }

  return warnings;
}
