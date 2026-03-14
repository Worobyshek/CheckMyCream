import test from "node:test";
import assert from "node:assert/strict";

import { normalizeIngredients } from "@/features/ingredient-analysis/services/normalize-ingredients";

test("normalizeIngredients handles duplicate tokens without ReferenceError", () => {
  const result = normalizeIngredients("Water, Glycerin, Water, Parfum", 0.8);

  assert.equal(result.ingredients.length, 3);
  assert.ok(result.ingredients.some((ingredient) => ingredient.normalized === "Water"));
  assert.ok(result.detectedDelimiters.includes("comma"));
});
