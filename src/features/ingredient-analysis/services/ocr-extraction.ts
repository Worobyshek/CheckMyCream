import {
  ocrProviderNameSchema,
  type OCRProviderAdapter,
} from "@/features/ingredient-analysis/adapters/ocr-provider";
import { tesseractOCRProvider } from "@/features/ingredient-analysis/adapters/tesseract-ocr-provider";
import {
  ocrExtractionResultSchema,
  type OCRExtractionResult,
} from "@/features/ingredient-analysis/domain";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

export async function extractTextFromImage(file: File): Promise<OCRExtractionResult> {
  validateImage(file);

  const provider = resolveOCRProvider();
  const extraction = await provider.extract(file);

  return ocrExtractionResultSchema.parse({
    ...extraction,
    source: "image",
  });
}

function resolveOCRProvider(): OCRProviderAdapter {
  const configuredProvider = ocrProviderNameSchema.safeParse(getServerEnv("OCR_PROVIDER") ?? "tesseract");

  if (!configuredProvider.success) {
    return tesseractOCRProvider;
  }

  switch (configuredProvider.data) {
    case "tesseract":
      return tesseractOCRProvider;
  }
}

function validateImage(file: File) {
  if (file.size === 0) {
    throw new AppError({
      code: "empty_file",
      message: "The selected file is empty. Please choose a valid image.",
      statusCode: 400,
    });
  }

  if (!acceptedMimeTypes.has(file.type)) {
    throw new AppError({
      code: "unsupported_image_type",
      message: "Only JPEG, PNG, and WEBP images are supported.",
      statusCode: 400,
    });
  }

  if (file.size > maxBytes) {
    throw new AppError({
      code: "image_too_large",
      message: "The image size must not exceed 10 MB.",
      statusCode: 400,
    });
  }
}
