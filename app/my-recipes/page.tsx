"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { RecipeView } from "@/lib/types/domain";
import { defaultPreferences } from "@/components/recipes/RecipePreferenceForm";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Toast, type ToastState } from "@/components/shared/Toast";

export default function MyRecipesPage() {
  const { profileId, locale, t } = useApp();
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [toast, setToast] = useState<ToastState>(null);

  function showToast(message: string, type: "success" | "error" | "info" = "info") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    if (!profileId) return;
    const response = await apiFetch<{ recipes: RecipeView[] }>("/api/recipes?favorites=1", { profileId, locale });
    setRecipes(response.recipes);
  }, [locale, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateSimilar(recipe: RecipeView) {
    if (!profileId) return;
    try {
      const response = await apiFetch<{ recipes: RecipeView[] }>("/api/generate-recipes", {
        method: "POST",
        profileId,
        locale,
        body: {
          profileId,
          locale,
          sourceRecipeId: recipe.id,
          manualIngredients: [],
          preferences: defaultPreferences
        }
      });
      setRecipes((current) => [...response.recipes, ...current]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    }
  }

  return (
    <main className="page-shell">
      <Toast toast={toast} />
      <section className="page-header">
        <h1 className="page-title">{t("myRecipes.title")}</h1>
      </section>
      {recipes.length === 0 ? <EmptyState message={t("myRecipes.empty")} /> : null}
      <section className="grid gap-4 xl:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onChanged={(updated) => setRecipes((current) => current.map((item) => (item.id === updated.id ? updated : item)))}
            onSimilar={(selected) => void generateSimilar(selected)}
            onToast={showToast}
          />
        ))}
      </section>
    </main>
  );
}
