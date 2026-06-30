"use client";

import type { AppLocale, MealCategory, RecipeView, SleepQuality } from "@/lib/types/domain";

export function recipeTranslation(recipe: RecipeView, locale: AppLocale) {
  return (
    recipe.translations.find((translation) => translation.locale === locale) ??
    recipe.translations.find((translation) => translation.locale === "en") ??
    recipe.translations[0]
  );
}

export function ingredientName(
  ingredient: { nameEn?: string; nameZh?: string; displayNameEn?: string; displayNameZh?: string },
  locale: AppLocale
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

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function recentIsoDates(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().slice(0, 10);
  });
}
