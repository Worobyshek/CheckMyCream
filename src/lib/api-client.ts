import {
  apiErrorResponseSchema,
  ingredientAnalysisResponseSchema,
  ocrExtractionResponseSchema,
  type IngredientAnalysisResponse,
  type OCRExtractionResponse,
} from "@/features/ingredient-analysis/schemas";

export class APIClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "APIClientError";
    this.code = code;
  }
}

const apiBaseUrl = normalizeAPIBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

export async function extractIngredientsFromImage(image: File): Promise<OCRExtractionResponse> {
  const formData = new FormData();
  formData.set("image", image);

  return postFormData({
    url: buildAPIUrl("/api/ocr-extract"),
    formData,
    schema: ocrExtractionResponseSchema,
    invalidFormatMessage: "The OCR service returned an invalid response format.",
    fallbackErrorMessage: "OCR extraction is temporarily unavailable.",
  });
}

export async function requestFullIngredientAnalysis(params: {
  ingredientsText: string;
  image?: File | null;
}): Promise<IngredientAnalysisResponse> {
  const formData = new FormData();
  formData.set("ingredientsText", params.ingredientsText);

  if (params.image) {
    formData.set("image", params.image);
  }

  return postFormData({
    url: buildAPIUrl("/api/analyze-ingredients"),
    formData,
    schema: ingredientAnalysisResponseSchema,
    invalidFormatMessage: "The server returned an invalid response format.",
    fallbackErrorMessage: "The analysis service is temporarily unavailable.",
  });
}

async function postFormData<T>({
  url,
  formData,
  schema,
  invalidFormatMessage,
  fallbackErrorMessage,
}: {
  url: string;
  formData: FormData;
  schema: {
    safeParse: (payload: unknown) => { success: true; data: T } | { success: false };
  };
  invalidFormatMessage: string;
  fallbackErrorMessage: string;
}): Promise<T> {
  let payload: unknown;

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    payload = (await response.json()) as unknown;

    if (!response.ok) {
      throw extractAPIClientError(payload, fallbackErrorMessage);
    }
  } catch (error) {
    if (error instanceof APIClientError) {
      throw error;
    }

    throw new APIClientError(
      "request_failed",
      "The request failed before the server returned a response.",
    );
  }

  const parsedPayload = schema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new APIClientError("invalid_response_format", invalidFormatMessage);
  }

  return parsedPayload.data;
}

function extractAPIClientError(payload: unknown, fallbackMessage: string): APIClientError {
  const parsedPayload = apiErrorResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return new APIClientError("unknown_api_error", fallbackMessage);
  }

  return new APIClientError(parsedPayload.data.error.code, parsedPayload.data.error.message);
}

function buildAPIUrl(path: string): string {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

function normalizeAPIBaseUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue.endsWith("/") ? trimmedValue.slice(0, -1) : trimmedValue;
}
