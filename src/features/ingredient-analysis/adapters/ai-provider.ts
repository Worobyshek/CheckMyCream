type AIProviderRequest = {
  systemPrompt: string;
  userPrompt: string;
  input: {
    extractedText: string;
    ocrConfidence: number | null;
    warnings: string[];
    normalizedIngredients: string[];
  };
};

export type AIProviderResponse = {
  rawResult: unknown;
};

export type AIProviderAdapter = {
  analyze(request: AIProviderRequest): Promise<AIProviderResponse>;
};

export type { AIProviderRequest };
