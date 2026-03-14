import { analyzeIngredientsFromSubmission } from "@/features/ingredient-analysis/services/analyze-ingredients";
import { createErrorResponseForRequest, createJSONResponse, createOptionsResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return createOptionsResponse(request);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const image = formData.get("image");
    const ingredientsText = formData.get("ingredientsText");

    const result = await analyzeIngredientsFromSubmission({
      image: image instanceof File ? image : null,
      ingredientsText: typeof ingredientsText === "string" ? ingredientsText : "",
    });

    return createJSONResponse(result, request);
  } catch (error) {
    return createErrorResponseForRequest(error, request);
  }
}
