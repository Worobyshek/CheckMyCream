import { z } from "zod";

import { type OCRExtractionResult } from "@/features/ingredient-analysis/domain";

export const ocrProviderNameSchema = z.enum(["tesseract"]);
export type OCRProviderName = z.infer<typeof ocrProviderNameSchema>;

export type OCRProviderAdapter = {
  extract(file: File): Promise<Omit<OCRExtractionResult, "source">>;
};
