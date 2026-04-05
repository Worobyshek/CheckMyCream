import { type NormalizedIngredient } from "@/features/ingredient-analysis/domain";

type BuildAIAnalysisPromptsParams = {
  extractedText: string;
  normalizedIngredients: NormalizedIngredient[];
  ocrConfidence: number | null;
  warnings: string[];
};

type AIAnalysisPrompts = {
  systemPrompt: string;
  userPrompt: string;
};

export function buildAIAnalysisPrompts({
  extractedText,
  normalizedIngredients,
  ocrConfidence,
  warnings,
}: BuildAIAnalysisPromptsParams): AIAnalysisPrompts {
  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt({
      extractedText,
      normalizedIngredients,
      ocrConfidence,
      warnings,
    }),
  };
}

function buildSystemPrompt(): string {
  return [
    "Ты - эксперт анализу косметических составов (INCI).",
    "Отвечай только на русском языке.",
    "Возвращай только валидный JSON без markdown, без пояснений вне JSON и без code fences.",
    "Используй строго такую верхнеуровневую структуру: productStatus, suitableFor, summary, beneficial, caution, neutral, unknown, confidence, warnings, assumptions, disclaimer.",
    "Каждый объект в beneficial, caution, neutral и unknown должен содержать только поля name и reason.",
    "Все текстовые поля JSON должны быть на русском языке.",
    'Поле productStatus должно содержать только одно из следующих значений: "Хороший", "Очень хороший", "Средний", "Нормальный", "Нейтральный", "Потенциально опасный", "Рискованный".',
    "Не добавляй в productStatus никаких пояснений, только одно точное значение из списка.",
    "Поле suitableFor должно быть одной короткой фразой о том, кому продукт может подойти: например по типу кожи, типу волос, чувствительности или общему сценарию использования. Если данных мало, скажи об этом.",
    "Поле summary должно быть более содержательным и развернутым, чем одна короткая фраза. Дай 2-4 предложения с общим мнением о продукте, впечатлением о балансе состава, мягким комментарием о сильных сторонах и о моментах, которые могут требовать внимания.",
    "Не выдумывай концентрации, проценты, дозировки, порядок ингредиентов или эффективность сверх того, что прямо следует из входных данных.",
    "Не ставь медицинские диагнозы, не давай лечебных рекомендаций.",
    "Для спорных или контекстно-зависимых ингредиентов используй осторожные формулировки: может, возможно, потенциально, может вызывать.",
    "Если OCR confidence низкий или есть предупреждения о неопределенности, понижай confidence и отражай неопределенность в warnings или assumptions.",
    "Если информации недостаточно, лучше выбрать более нейтральный статус и явно отметить ограничения в suitableFor, warnings или assumptions.",
    "confidence должен быть числом от 0 до 1.",
    "warnings и assumptions должны быть массивами строк.",
    "disclaimer должен быть одной строкой с указанием, что результат носит информационный характер и не является медицинской рекомендацией.",
  ].join(" ");
}

function buildUserPrompt({
  extractedText,
  normalizedIngredients,
  ocrConfidence,
  warnings,
}: BuildAIAnalysisPromptsParams): string {
  const normalizedList = normalizedIngredients.map((ingredient) => ingredient.normalized);
  const serializedWarnings =
    warnings.length > 0 ? warnings : ["Предупреждения от предыдущих этапов отсутствуют."];
  const ocrConfidenceValue = ocrConfidence === null ? "не применимо" : ocrConfidence.toFixed(2);

  return [
    "Проанализируй этот состав косметического продукта и верни только валидный JSON.",
    "",
    "Контекст входных данных:",
    `- OCR confidence: ${ocrConfidenceValue}`,
    `- Warnings предыдущих этапов: ${JSON.stringify(serializedWarnings)}`,
    `- Извлеченный текст: ${JSON.stringify(extractedText)}`,
    `- Нормализованные ингредиенты: ${JSON.stringify(normalizedList)}`,
    "",
    "Правила интерпретации:",
    "- beneficial: ингредиенты, которые в косметическом контексте обычно считаются потенциально полезными.",
    "- caution: ингредиенты, которые могут требовать осторожной интерпретации.",
    "- neutral: ингредиенты, которые выглядят функционально стандартными и нейтральными в этом контексте.",
    "- unknown: ингредиенты, которые нельзя уверенно классифицировать по доступным данным.",
    "- suitableFor: коротко укажи, кому продукт может подойти, например для сухой, нормальной, комбинированной, чувствительной кожи или для пользователей без выраженной чувствительности.",
    "- summary: дай более полное мнение о продукте. Коротко опиши, каким выглядит состав в целом, какое он оставляет впечатление, есть ли в нем потенциально удачные или спорные стороны. Пиши не одной короткой фразой, а 2-4 осмысленными предложениями.",
    "- Если информации недостаточно, предпочитай unknown и более нейтральный статус вместо чрезмерно уверенных выводов.",
    "- Никогда не делай выводов о точной концентрации или силе действия.",
    "- Никогда не ставь медицинский диагноз.",
    "- Если OCR confidence ниже 0.70, явно отрази неопределенность в warnings или assumptions и понизь confidence.",
    "",
    "Верни только JSON.",
  ].join("\n");
}
