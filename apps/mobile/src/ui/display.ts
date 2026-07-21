import type { MealCategory, RecipeView, SleepQuality } from "../domain";

export function recipeTranslation(recipe: RecipeView, locale: "en" | "zh-CN") {
  return (
    recipe.translations.find((translation) => translation.locale === locale) ??
    recipe.translations.find((translation) => translation.locale === "en") ??
    recipe.translations[0]
  );
}

export function ingredientName(
  ingredient: { nameEn?: string | null; nameZh?: string | null; displayNameEn?: string | null; displayNameZh?: string | null },
  locale: "en" | "zh-CN"
) {
  if (locale === "zh-CN") {
    return ingredient.nameZh || ingredient.displayNameZh || ingredient.nameEn || ingredient.displayNameEn || "";
  }
  return ingredient.nameEn || ingredient.displayNameEn || ingredient.nameZh || ingredient.displayNameZh || "";
}

export function mealCategoryKey(category: MealCategory) {
  return `food.${category}` as const;
}

export function sleepQualityKey(quality: SleepQuality) {
  return `wellness.${quality}` as const;
}
