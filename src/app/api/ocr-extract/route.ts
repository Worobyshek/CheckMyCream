import { ocrExtractionResponseSchema } from "@/features/ingredient-analysis/schemas";
import { extractTextFromImage } from "@/features/ingredient-analysis/services/ocr-extraction";
import { createErrorResponseForRequest, createJSONResponse, createOptionsResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return createOptionsResponse(request);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return createJSONResponse(
        {
          error: {
            code: "missing_image",
            message: "Attach an image in the image field.",
          },
        },
        request,
        400,
      );
    }

    const extraction = await extractTextFromImage(image);
    const response = ocrExtractionResponseSchema.parse({
      rawText: extraction.rawText,
      cleanedText: extraction.cleanedText,
      ingredientsCandidate: extraction.ingredientsCandidate,
      confidence: extraction.confidence,
      warnings: extraction.warnings,
    });

    return createJSONResponse(response, request);
  } catch (error) {
    return createErrorResponseForRequest(error, request);
  }
}
