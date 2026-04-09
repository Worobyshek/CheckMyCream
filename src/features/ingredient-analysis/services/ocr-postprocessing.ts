export function normalizeOCRText(rawText: string): string {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/[|\u00A6]/g, "I")
    .replace(/[\u2022\u00B7]/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s*[,;]\s*/g, ", ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function extractIngredientCandidates(cleanedText: string): string[] {
  return cleanedText
    .split(/[,;\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}
