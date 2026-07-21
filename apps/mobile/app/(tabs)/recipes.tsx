import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { IngredientScanView, RecipePreferenceInput, RecipeView } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { isoToday } from "../../src/utils/date";

const defaultPreferences: RecipePreferenceInput = {
  cuisine: "No Preference",
  cookingTime: "No Preference",
  difficulty: "no_preference",
  dietaryPreference: "No Preference",
  equipment: "No Preference",
  recognizedOnly: false,
  allowSeasonings: true,
  allowOptionalExtras: true
};

function recipeTitle(recipe: RecipeView, locale: "en" | "zh-CN") {
  return recipe.translations.find((item) => item.locale === locale)?.title ?? recipe.translations.find((item) => item.locale === "en")?.title ?? recipe.cuisineStyle;
}

export default function RecipesScreen() {
  const { adapter, locale, t, initialized, initError, activateLocalMode } = useApp();
  const [scans, setScans] = useState<IngredientScanView[]>([]);
  const [selectedScanId, setSelectedScanId] = useState("");
  const [preferences, setPreferences] = useState<RecipePreferenceInput>(defaultPreferences);
  const [showPreferences, setShowPreferences] = useState(false);
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!initialized || initError) return;
    let active = true;
    setLoading(true);
    setMessage(null);
    console.log("RecipesScreen: Starting load...");
    void Promise.all([adapter.getIngredientScans(), adapter.getRecipes()])
      .then(([nextScans, savedRecipes]) => {
        if (!active) return;
        console.log("RecipesScreen: Load complete. Scans:", nextScans.length, "Recipes:", savedRecipes.length);
        const confirmed = nextScans.filter((scan) => Boolean(scan.confirmedAt));
        setScans(confirmed);
        setSelectedScanId(confirmed[0]?.id ?? "");
        setRecipes(savedRecipes);
      })
      .catch((error: unknown) => {
        console.error("RecipesScreen: Load failed:", error);
        if (active) setMessage(error instanceof Error ? error.message : t("common.error"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [adapter, t, initialized, initError]);

  useEffect(() => {
    return load();
  }, [load]);

  async function generate() {
    if (!selectedScanId) {
      setMessage(t("smart.confirmFirst"));
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const next = await adapter.generateRecipes({ scanId: selectedScanId, locale, preferences });
      setRecipes(next);
      setShowPreferences(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setGenerating(false);
    }
  }

  const preferenceOption = (label: string, field: keyof RecipePreferenceInput, value: string) => (
    <Pressable
      onPress={() => setPreferences({ ...preferences, [field]: value })}
      style={[shared.secondaryButton, { flex: 1, minWidth: "45%", paddingVertical: 8 }, preferences[field] === value && { backgroundColor: colors.mint, borderColor: colors.leaf }]}
    >
      <Text style={[shared.secondaryButtonText, { fontSize: 13 }, preferences[field] === value && { fontWeight: "700" }]}>{value}</Text>
    </Pressable>
  );

  async function logAsMeal(recipe: RecipeView) {
    const title = recipeTitle(recipe, locale);
    setGenerating(true);
    try {
      await adapter.saveFoodLog({
        recipeId: recipe.id,
        date: isoToday(),
        mealCategory: "lunch", // Default to lunch, or we could ask
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
      setGenerating(false);
    }
  }

  if (!initialized || (loading && recipes.length === 0)) {
    return (
      <SafeAreaView style={shared.page}>
        <View style={[shared.content, { alignItems: "center", paddingTop: 80, gap: 20 }]}>
          <ActivityIndicator size="large" color={colors.leaf} />
          <Text style={shared.helper}>Loading recipes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (initError || (message && recipes.length === 0)) {
    return (
      <SafeAreaView style={shared.page}>
        <View style={[shared.content, { alignItems: "center", paddingTop: 80, gap: 16 }]}>
          <Text style={[shared.error, { textAlign: "center", paddingHorizontal: 20 }]}>{initError || message}</Text>
          <Pressable style={shared.primaryButton} onPress={() => load()}>
            <Text style={shared.primaryButtonText}>Try Again</Text>
          </Pressable>
          {Platform.OS !== "web" && (
            <Pressable style={shared.secondaryButton} onPress={() => void activateLocalMode()}>
              <Text style={shared.secondaryButtonText}>Use Local Offline Mode</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.header}><Text style={shared.title}>{t("recipes.title")}</Text><Text style={shared.subtitle}>{t("recipes.subtitle")}</Text></View>
        {message ? <Text style={shared.error}>{message}</Text> : null}

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("recipes.source")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
              {scans.length === 0 ? <Text style={shared.helper}>{t("smart.confirmFirst")}</Text> : scans.map((scan) => {
                const selected = selectedScanId === scan.id;
                return <Pressable key={scan.id} onPress={() => setSelectedScanId(scan.id)} style={{ borderWidth: 1, borderColor: selected ? colors.leaf : colors.line, borderRadius: 10, padding: 12, backgroundColor: selected ? colors.mint : "#FFF", minWidth: 200 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{scan.ingredients.map((item) => locale === "zh-CN" ? item.displayNameZh : item.displayNameEn).join(", ")}</Text>
                  <Text style={[shared.helper, { fontSize: 11 }]}>{new Date(scan.createdAt).toLocaleDateString()}</Text>
                </Pressable>;
              })}
            </View>
          </ScrollView>

          <Pressable onPress={() => setShowPreferences(!showPreferences)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <Text style={[shared.label, { marginBottom: 0 }]}>{t("recipes.preferences")}</Text>
            <Text style={{ color: colors.leaf, fontWeight: "700" }}>{showPreferences ? "−" : "+"}</Text>
          </Pressable>

          {showPreferences && (
            <View style={{ gap: 12, marginTop: 12 }}>
              <Text style={shared.label}>{t("recipes.cuisine")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["No Preference", "Chinese", "Western", "Japanese", "Malay"].map(c => preferenceOption(c, "cuisine", c))}
              </View>

              <Text style={shared.label}>{t("recipes.difficulty")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["no_preference", "easy", "medium", "hard"].map(d => preferenceOption(d, "difficulty", d))}
              </View>
            </View>
          )}

          <Pressable style={[shared.primaryButton, (!selectedScanId || generating) && { opacity: 0.55 }, { marginTop: 16 }]} disabled={!selectedScanId || generating} onPress={() => void generate()}>
            {generating ? <ActivityIndicator color="white" /> : <Text style={shared.primaryButtonText}>{t("recipes.generate")}</Text>}
          </Pressable>
        </View>
        {recipes.length === 0 ? <View style={shared.panel}><Text style={shared.helper}>{t("recipes.noRecipes")}</Text></View> : null}
        {recipes.map((recipe) => (
          <View key={recipe.id} style={shared.panel}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={shared.sectionTitle}>{recipeTitle(recipe, locale)}</Text>
              </View>
              <Pressable onPress={() => void adapter.saveRecipe(recipe.id, { isFavorite: !recipe.isFavorite }).then((updated) => setRecipes(current => current.map(r => r.id === updated.id ? updated : r)))}>
                <Text style={{ fontSize: 24, color: recipe.isFavorite ? colors.leaf : colors.line }}>{recipe.isFavorite ? "★" : "☆"}</Text>
              </Pressable>
            </View>
            <Text style={shared.helper}>{recipe.estimatedCookingMinutes} {t("common.minutes")} · {recipe.difficulty}</Text>
            <Text style={{ color: colors.text, fontWeight: "700", marginTop: 8 }}>{t("recipes.ingredients")}</Text>
            {recipe.ingredients.map((ingredient) => <Text key={ingredient.id} style={shared.helper}>• {locale === "zh-CN" ? ingredient.nameZh : ingredient.nameEn} — {ingredient.amount}</Text>)}
            <Text style={{ color: colors.text, fontWeight: "700", marginTop: 8 }}>{t("recipes.steps")}</Text>
            {recipe.steps.map((step) => <Text key={step.id} style={shared.helper}>{step.stepNumber}. {locale === "zh-CN" ? step.instructionZh : step.instructionEn}</Text>)}

            <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 16, paddingTop: 12 }}>
              <Pressable
                disabled={generating}
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
