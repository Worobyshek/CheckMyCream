import {
  type AIProviderAdapter,
  type AIProviderRequest,
} from "@/features/ingredient-analysis/adapters/ai-provider";

export const mockAIProvider: AIProviderAdapter = {
  async analyze(request: AIProviderRequest) {
    const normalizedIngredients = request.input.normalizedIngredients;

    return {
      rawResult: {
        productStatus: normalizedIngredients.some((item) => item.toLowerCase() === "parfum")
          ? "Есть риски"
          : "Хороший",
        suitableFor: normalizedIngredients.some((item) => item.toLowerCase() === "parfum")
          ? "Может подойти нормальной коже и волосам без выраженной чувствительности, но требует более внимательной проверки при склонности к раздражению."
          : "Чаще всего может подойти нормальной, сухой и комбинированной коже, если нет индивидуальной чувствительности к отдельным компонентам.",
        summary:
          "Формула выглядит достаточно типичной для косметического средства, но итоговое восприятие зависит от чувствительности к отдельным компонентам.",
        beneficial: normalizedIngredients
          .filter((item) => ["Glycerin", "Niacinamide", "Panthenol"].includes(item))
          .map((item) => ({
            name: item,
            reason: "Часто используется в косметических формулах как поддерживающий и ухаживающий компонент.",
          })),
        caution: normalizedIngredients
          .filter((item) => ["Parfum", "Fragrance", "Essential Oil"].includes(item))
          .map((item) => ({
            name: item,
            reason: "Может быть нежелателен для чувствительной кожи или при индивидуальной склонности к раздражению.",
          })),
        neutral: normalizedIngredients.slice(0, 3).map((item) => ({
          name: item,
          reason: "В этом контексте выглядит как стандартный косметический компонент.",
        })),
        unknown: normalizedIngredients.slice(3, 5).map((item) => ({
          name: item,
          reason: "Для уверенной классификации по текущим данным не хватает контекста.",
        })),
        confidence: request.input.ocrConfidence === null ? 0.86 : Math.max(0.45, request.input.ocrConfidence),
        warnings: ["Используется mock AI provider.", ...request.input.warnings].slice(0, 4),
        assumptions: [
          "Предполагается, что извлеченная последовательность действительно является списком ингредиентов косметического продукта.",
        ],
        disclaimer:
          "Этот анализ носит информационный характер, не является медицинской рекомендацией и не определяет концентрации ингредиентов.",
      },
    };
  },
};
