import { randomUUID } from "node:crypto";

import {
  type AIProviderAdapter,
  type AIProviderRequest,
} from "@/features/ingredient-analysis/adapters/ai-provider";
import { getRequiredServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/http";

type OpenRouterMessage = {
  content?: unknown;
};

type OpenRouterChoice = {
  message?: OpenRouterMessage;
};

type OpenRouterResponse = {
  choices?: unknown;
};

export const remoteAIProvider: AIProviderAdapter = {
  async analyze(request: AIProviderRequest) {
    const apiUrl = getRequiredServerEnv("AI_API_URL");
    const apiKey = getRequiredServerEnv("AI_API_KEY");
    const model = getRequiredServerEnv("AI_MODEL");

    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Request-Id": randomUUID(),
        },
        cache: "no-store",
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      },
      15000,
      new AppError({
        code: "analysis_timeout",
        message: "The AI analysis service took too long to respond. Please try again.",
        statusCode: 504,
      }),
    );

    if (!response.ok) {
      const upstreamBody = await safeReadText(response);

      console.error("[remote-ai-provider] request failed", {
        stage: "ai-provider",
        code: "analysis_upstream_failed",
        statusCode: 502,
        message: summarizeUpstreamBody(upstreamBody),
      });

      throw new AppError({
        code: "analysis_upstream_failed",
        message: `The external AI API is temporarily unavailable. Upstream response: ${upstreamBody}`,
        statusCode: 502,
      });
    }

    let payload: OpenRouterResponse;

    try {
      payload = (await response.json()) as OpenRouterResponse;
    } catch {
      throw new AppError({
        code: "analysis_invalid_json",
        message: "The external AI API returned an unreadable response.",
        statusCode: 502,
      });
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = choices[0] as OpenRouterChoice | undefined;
    const content =
      typeof firstChoice?.message?.content === "string" ? firstChoice.message.content : "";

    if (content.trim().length === 0) {
      throw new AppError({
        code: "analysis_invalid_json",
        message: "The external AI API returned an empty message content.",
        statusCode: 502,
      });
    }

    const normalizedContent = stripMarkdownCodeFences(content);
    const rawResult = tryParseJSON(normalizedContent);

    return {
      rawResult,
    };
  },
};

async function safeReadText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim().length > 0 ? text.trim() : "<empty body>";
  } catch {
    return "<unreadable body>";
  }
}

function stripMarkdownCodeFences(content: string): string {
  const trimmed = content.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, "").replace(/\s*```$/, "").trim();
}

function tryParseJSON(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

function summarizeUpstreamBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();

  if (normalized.length === 0 || normalized === "<empty body>" || normalized === "<unreadable body>") {
    return "The external AI API returned an empty or unreadable response body.";
  }

  return normalized.slice(0, 180);
}
