import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { NutritionSummaryView } from "../domain";
import { colors, shared } from "./styles";

const macroRows = [
  {
    key: "protein" as const,
    labelKey: "food.macroProtein" as const,
    color: "#059669", // emerald-600
    bg: "#ECFDF5", // emerald-50
    text: "#064E3B", // emerald-900
  },
  {
    key: "carbs" as const,
    labelKey: "food.macroCarbs" as const,
    color: "#0EA5E9", // sky-500
    bg: "#F0F9FF", // sky-50
    text: "#0C4A6E", // sky-900
  },
  {
    key: "fat" as const,
    labelKey: "food.macroFat" as const,
    color: "#F59E0B", // amber-500
    bg: "#FFFBEB", // amber-50
    text: "#78350F", // amber-900
  }
];

function macroValue(summary: NutritionSummaryView, key: "protein" | "carbs" | "fat") {
  if (key === "protein") return { grams: summary.proteinGrams, calories: summary.proteinCalories, percent: summary.proteinPercent };
  if (key === "carbs") return { grams: summary.carbsGrams, calories: summary.carbsCalories, percent: summary.carbsPercent };
  return { grams: summary.fatGrams, calories: summary.fatCalories, percent: summary.fatPercent };
}

export function NutritionStructurePanel({ summary, t }: { summary: NutritionSummaryView; t: (k: any) => string }) {
  const hasMacros = summary.trackedMacroCalories > 0;

  return (
    <View style={shared.panel}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={shared.sectionTitle}>{t("food.nutritionStructure")}</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 11, color: "#64748B" }}>{t("food.macroTrackedCalories")}: {summary.trackedMacroCalories} kcal</Text>
          <Text style={{ fontSize: 11, color: "#64748B" }}>{t("food.macroTrackedEntries")}: {summary.trackedEntries}</Text>
        </View>
      </View>

      <View style={{ height: 12, backgroundColor: "#E2E8F0", borderRadius: 6, overflow: "hidden", flexDirection: "row" }}>
        {hasMacros ? macroRows.map((row) => {
          const value = macroValue(summary, row.key);
          if (value.percent <= 0) return null;
          return <View key={row.key} style={{ height: "100%", width: `${value.percent}%`, backgroundColor: row.color }} />;
        }) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        {macroRows.map((row) => {
          const value = macroValue(summary, row.key);
          return (
            <View key={row.key} style={{ flex: 1, backgroundColor: row.bg, padding: 10, borderRadius: 8, gap: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: row.text }}>{t(row.labelKey)}</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: row.text }}>{value.grams}g</Text>
              <Text style={{ fontSize: 10, color: row.text, opacity: 0.7 }}>{value.percent}% · {value.calories} kcal</Text>
            </View>
          );
        })}
      </View>

      {hasMacros ? (
        <Text style={{ fontSize: 12, color: "#64748B", marginTop: 12 }}>
          {t("food.macroUntrackedCalories")}: {summary.untrackedCalories} kcal
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: "#64748B", marginTop: 12 }}>{t("food.macroEmpty")}</Text>
      )}
    </View>
  );
}
