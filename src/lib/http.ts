import { NextResponse } from "next/server";

import { AppError, toAppError } from "@/lib/errors";
import { getServerEnv } from "@/lib/env";

const allowedOrigins = getAllowedOrigins();

export function createErrorResponse(error: unknown) {
  return createErrorResponseForRequest(error, null);
}

export function createErrorResponseForRequest(error: unknown, request: Request | null) {
  const appError = toAppError(error);

  if (error instanceof AppError) {
    console.error("[http] AppError response", {
      stage: "http",
      code: appError.code,
      statusCode: appError.statusCode,
      message: appError.message,
    });
  } else {
    console.error("[http] request failed", {
      stage: "http",
      code: "internal_error",
      statusCode: 500,
      message: "The request could not be processed.",
    });
  }

  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
      },
    },
    {
      status: appError.statusCode,
      headers: buildCORSHeaders(request),
    },
  );
}

export function createJSONResponse(body: unknown, request: Request, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: buildCORSHeaders(request),
  });
}

export function createOptionsResponse(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCORSHeaders(request),
  });
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutError: AppError,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCORSHeaders(request: Request | null): HeadersInit | undefined {
  if (!request) {
    return undefined;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return undefined;
  }

  const isAllowed =
    allowedOrigins.includes("*") || allowedOrigins.includes(origin);

  if (!isAllowed) {
    return {
      Vary: "Origin",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function getAllowedOrigins(): string[] {
  const rawValue = getServerEnv("CORS_ALLOWED_ORIGINS");

  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
