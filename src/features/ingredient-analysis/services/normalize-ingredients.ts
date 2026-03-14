import {
  ingredientNormalizationResultSchema,
  type IngredientNormalizationResult,
  type NormalizedIngredient,
} from "@/features/ingredient-analysis/domain";
import { AppError } from "@/lib/errors";

const delimiterPatterns = [
  { pattern: /,/g, value: "comma" as const },
  { pattern: /;/g, value: "semicolon" as const },
  { pattern: /\r?\n/g, value: "newline" as const },
  { pattern: /[•·●]/g, value: "bullet" as const },
];

export function normalizeIngredients(
  rawText: string,
  baseConfidence: number,
): IngredientNormalizationResult {
  const cleanedText = sanitizeRawText(rawText);
  const normalizedText = normalizeDelimiters(cleanedText);
  const detectedDelimiters = detectDelimiters(rawText);
  const splitIngredientsResult = splitIngredients(normalizedText);
  const ingredients = splitIngredientsResult.uniqueIngredients.map((item) =>
    createNormalizedIngredient(item, baseConfidence),
  );
  const qualityFlags = detectQualityFlags({
    rawText,
    normalizedText,
    ingredients,
    splitIngredientCount: splitIngredientsResult.allIngredients.length,
  });
  const warnings = buildWarnings(qualityFlags);

  if (ingredients.length === 0) {
    throw new AppError({
      code: "empty_ingredients",
      message: "No ingredient list could be extracted. Please review the text and try again.",
      statusCode: 422,
    });
  }

  return ingredientNormalizationResultSchema.parse({
    normalizedText,
    ingredients,
    detectedDelimiters,
    qualityFlags,
    warnings,
  });
}

function createNormalizedIngredient(value: string, baseConfidence: number): NormalizedIngredient {
  return {
    raw: value,
    normalized: normalizeIngredientToken(value),
    confidence: Number(baseConfidence.toFixed(2)),
  };
}

function sanitizeRawText(rawText: string): string {
  return rawText
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[,;:]\s*/g, ", ")
    .trim();
}

function normalizeDelimiters(text: string): string {
  return text
    .replace(/[•·●]/g, ",")
    .replace(/[;:]+/g, ",")
    .replace(/\r?\n+/g, ",")
    .replace(/,+/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^,\s*|\s*,$/g, "")
    .trim();
}

function detectDelimiters(rawText: string): IngredientNormalizationResult["detectedDelimiters"] {
  const detected = delimiterPatterns
    .filter(({ pattern }) => rawText.match(pattern))
    .map(({ value }) => value);

  return detected.length > 0 ? detected : ["unknown"];
}

function splitIngredients(normalizedText: string): {
  allIngredients: string[];
  uniqueIngredients: string[];
} {
  const commaSplit = normalizedText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(removeEdgeNoise)
    .filter(Boolean);

  if (commaSplit.length > 1) {
    return {
      allIngredients: commaSplit,
      uniqueIngredients: dedupePreservingOrder(commaSplit),
    };
  }

  const fallbackSpaceSplit = normalizedText
    .split(/\s{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(removeEdgeNoise)
    .filter(Boolean);

  return {
    allIngredients: fallbackSpaceSplit,
    uniqueIngredients: dedupePreservingOrder(fallbackSpaceSplit),
  };
}

function removeEdgeNoise(value: string): string {
  return value.replace(/^[^A-Za-z]+|[^A-Za-z0-9]+$/g, "").trim();
}

function dedupePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function detectQualityFlags({
  rawText,
  normalizedText,
  ingredients,
  splitIngredientCount,
}: {
  rawText: string;
  normalizedText: string;
  ingredients: NormalizedIngredient[];
  splitIngredientCount: number;
}): IngredientNormalizationResult["qualityFlags"] {
  const flags: IngredientNormalizationResult["qualityFlags"] = [];

  if (ingredients.length < 3) {
    flags.push("low_ingredient_count");
  }

  if (/[@#$%^*=+\\]/.test(rawText)) {
    flags.push("contains_unusual_symbols");
  }

  const noiseMatches = rawText.match(/[0-9]{3,}|[_~`]/g);
  if ((noiseMatches?.length ?? 0) >= 2) {
    flags.push("high_noise");
  }

  if (normalizedText.length > 60 && !normalizedText.includes(",")) {
    flags.push("long_unbroken_text");
  }

  const duplicateCount = splitIngredientCount - ingredients.length;
  if (duplicateCount >= 2) {
    flags.push("duplicate_heavy");
  }

  return flags;
}

function buildWarnings(
  qualityFlags: IngredientNormalizationResult["qualityFlags"],
): IngredientNormalizationResult["warnings"] {
  return qualityFlags.map((flag) => {
    switch (flag) {
      case "low_ingredient_count":
        return "Only a small number of ingredients were detected.";
      case "high_noise":
        return "The OCR text contains noticeable noise.";
      case "contains_unusual_symbols":
        return "The text includes unusual symbols that may indicate OCR errors.";
      case "long_unbroken_text":
        return "The ingredient text could not be split confidently.";
      case "duplicate_heavy":
        return "Many repeated tokens were removed during normalization.";
    }
  });
}

function normalizeIngredientToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

/*
Example 1:
Input: "Water; Glycerin; Niacinamide; Parfum"
Output:
{
  normalizedText: "Water, Glycerin, Niacinamide, Parfum",
  ingredients: ["Water", "Glycerin", "Niacinamide", "Parfum"],
  detectedDelimiters: ["semicolon"],
  qualityFlags: [],
  warnings: []
}

Example 2:
Input: "WATER  GLYCERIN### NIACINAMIDE___ PARFUM"
Output:
{
  normalizedText: "WATER GLYCERIN### NIACINAMIDE___ PARFUM",
  ingredients: ["Water Glycerin### Niacinamide___ Parfum"],
  detectedDelimiters: ["unknown"],
  qualityFlags: ["low_ingredient_count", "contains_unusual_symbols", "high_noise", "long_unbroken_text"],
  warnings: [...]
}

Example 3:
Input: "Water, Glycerin, Water, Parfum"
Output:
{
  normalizedText: "Water, Glycerin, Water, Parfum",
  ingredients: ["Water", "Glycerin", "Parfum"],
  detectedDelimiters: ["comma"],
  qualityFlags: [],
  warnings: []
}
*/
