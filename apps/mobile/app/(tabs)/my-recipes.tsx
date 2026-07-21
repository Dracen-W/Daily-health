import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RecipeView } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { EmptyState } from "../../src/ui/EmptyState";
import { isoToday } from "../../src/utils/date";

function recipeTitle(recipe: RecipeView, locale: "en" | "zh-CN") {
  return recipe.translations.find((item) => item.locale === locale)?.title ?? recipe.translations.find((item) => item.locale === "en")?.title ?? recipe.cuisineStyle;
}

export default function MyRecipesScreen() {
  const { adapter, locale, t } = useApp();
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const savedRecipes = await adapter.getRecipes({ favorites: true });
      setRecipes(savedRecipes);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [adapter, t]);

  useEffect(() => { void load(); }, [load]);

  async function generateSimilar(recipe: RecipeView) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await adapter.generateRecipes({
        sourceRecipeId: recipe.id,
        locale,
        preferences: {
          cuisine: "No Preference",
          cookingTime: "No Preference",
          difficulty: "no_preference",
          dietaryPreference: "No Preference",
          equipment: "No Preference",
          recognizedOnly: false,
          allowSeasonings: true,
          allowOptionalExtras: true
        }
      });
      setRecipes((current) => [...next, ...current]);
      Alert.alert(t("common.success"), "Generated 3 similar recipes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function logAsMeal(recipe: RecipeView) {
    const title = recipeTitle(recipe, locale);
    setBusy(true);
    try {
      await adapter.saveFoodLog({
        recipeId: recipe.id,
        date: isoToday(),
        mealCategory: "lunch",
        nameEn: title,
        nameZh: locale === "zh-CN" ? title : null,
        calories: recipe.estimatedCaloriesPerServing,
        proteinGrams: recipe.estimatedProteinGramsPerServing,
        carbsGrams: recipe.estimatedCarbsGramsPerServing,
        fatGrams: recipe.estimatedFatGramsPerServing,
        notes: `Recipe: ${title}`,
        sourceType: "recipe"
      });
      Alert.alert(t("common.success"), t("recipes.favorited"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <SafeAreaView style={shared.page}><View style={[shared.content, { alignItems: "center", paddingTop: 48 }]}><ActivityIndicator color={colors.leaf} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.header}>
          <Text style={shared.title}>{t("myRecipes.title")}</Text>
          <Text style={shared.subtitle}>{t("myRecipes.empty")}</Text>
        </View>
        {message ? <Text style={shared.error}>{message}</Text> : null}

        {recipes.length === 0 ? <EmptyState message={t("myRecipes.empty")} /> : null}

        {recipes.map((recipe) => (
          <View key={recipe.id} style={shared.panel}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={shared.sectionTitle}>{recipeTitle(recipe, locale)}</Text>
              </View>
              <Pressable onPress={() => void adapter.saveRecipe(recipe.id, { isFavorite: !recipe.isFavorite }).then((updated) => setRecipes(current => current.filter(r => r.id !== recipe.id || updated.isFavorite)))}>
                <Text style={{ fontSize: 24, color: recipe.isFavorite ? colors.leaf : colors.line }}>{recipe.isFavorite ? "★" : "☆"}</Text>
              </Pressable>
            </View>
            <Text style={shared.helper}>{recipe.estimatedCookingMinutes} {t("common.minutes")} · {recipe.difficulty}</Text>
            <Text style={{ color: colors.text, fontWeight: "700", marginTop: 8 }}>{t("recipes.ingredients")}</Text>
            {recipe.ingredients.map((ingredient) => <Text key={ingredient.id} style={shared.helper}>• {locale === "zh-CN" ? ingredient.nameZh : ingredient.nameEn} — {ingredient.amount}</Text>)}
            <Text style={{ color: colors.text, fontWeight: "700", marginTop: 8 }}>{t("recipes.steps")}</Text>
            {recipe.steps.map((step) => <Text key={step.id} style={shared.helper}>{step.stepNumber}. {locale === "zh-CN" ? step.instructionZh : step.instructionEn}</Text>)}

            <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 16, paddingTop: 12, gap: 10 }}>
              <Pressable
                disabled={busy}
                style={[shared.primaryButton, { backgroundColor: colors.leafDark }]}
                onPress={() => void generateSimilar(recipe)}
              >
                <Text style={shared.primaryButtonText}>{t("recipes.similar")}</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                style={[shared.secondaryButton, { borderColor: colors.leaf }]}
                onPress={() => void logAsMeal(recipe)}
              >
                <Text style={shared.secondaryButtonText}>{t("recipes.logMeal")}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
