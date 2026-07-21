import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { FoodLogView, NutritionSummaryView } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { NutritionStructurePanel } from "../../src/ui/NutritionStructurePanel";
import { EmptyState } from "../../src/ui/EmptyState";
import { isoToday, numeric } from "../../src/utils/date";

type Category = "breakfast" | "lunch" | "dinner" | "snack";
const categories: Category[] = ["breakfast", "lunch", "dinner", "snack"];
const blank = { name: "", calories: "", protein: "", carbs: "", fat: "", notes: "" };

export default function FoodLogScreen() {
  const { adapter, locale, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [logs, setLogs] = useState<FoodLogView[]>([]);
  const [total, setTotal] = useState(0);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummaryView | null>(null);
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [category, setCategory] = useState<Category>("breakfast");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await adapter.getFoodLogs(date);
      setLogs(response.logs);
      setTotal(response.total);
      setNutritionSummary(response.nutritionSummary);
      setCalorieTarget(response.calorieTarget);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }, [adapter, date, t]);

  useEffect(() => { void load(); }, [load]);

  function startEdit(log: FoodLogView) {
    setEditingId(log.id);
    setCategory(log.mealCategory);
    setForm({
      name: locale === "zh-CN" ? log.nameZh ?? log.nameEn : log.nameEn,
      calories: log.calories ? String(log.calories) : "",
      protein: log.proteinGrams ? String(log.proteinGrams) : "",
      carbs: log.carbsGrams ? String(log.carbsGrams) : "",
      fat: log.fatGrams ? String(log.fatGrams) : "",
      notes: log.notes ?? ""
    });
    setShowForm(true);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(blank);
    setShowForm(false);
    setMessage(null);
  }

  async function save() {
    if (!form.name.trim()) { setMessage("Enter a food name."); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await adapter.saveFoodLog({
        id: editingId ?? undefined,
        recipeId: null,
        date,
        mealCategory: category,
        nameEn: form.name.trim(),
        nameZh: locale === "zh-CN" ? form.name.trim() : null,
        calories: numeric(form.calories),
        proteinGrams: numeric(form.protein),
        carbsGrams: numeric(form.carbs),
        fatGrams: numeric(form.fat),
        notes: form.notes || null,
        sourceType: "manual"
      });
      setLogs(response.logs);
      setTotal(response.total);
      setNutritionSummary(response.nutritionSummary);
      setCalorieTarget(response.calorieTarget);
      setForm(blank);
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function estimate() {
    if (!form.name.trim()) { setMessage("Enter a food name first."); return; }
    setBusy(true); setMessage(null);
    try {
      const result = await adapter.estimateNutrition({ nameEn: form.name.trim(), nameZh: locale === "zh-CN" ? form.name.trim() : null });
      setForm({
        ...form,
        calories: result.calories ? String(result.calories) : "",
        protein: result.proteinGrams ? String(result.proteinGrams) : "",
        carbs: result.carbsGrams ? String(result.carbsGrams) : "",
        fat: result.fatGrams ? String(result.fatGrams) : ""
      });
      setMessage(locale === "zh-CN" ? result.notesZh : result.notesEn);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await adapter.deleteFoodLog(id, date);
      setTotal(response.total);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const field = (placeholder: string, value: string, onChangeText: (text: string) => void, keyboardType: "default" | "numeric" = "default") => (
    <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={shared.input} />
  );

  const isOverTarget = calorieTarget != null && total > calorieTarget;
  const remaining = calorieTarget != null ? Math.max(0, calorieTarget - total) : null;
  const excess = calorieTarget != null ? Math.max(0, total - calorieTarget) : null;

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={shared.header}>
          <Text style={shared.title}>{t("food.title")}</Text>
          <Text style={shared.subtitle}>{total} kcal {t("food.dailyTotal").toLowerCase()}</Text>
        </View>

        {message ? <Text style={shared.error}>{message}</Text> : null}

        <View style={shared.panel}>
          <Text style={shared.label}>{t("common.date")}</Text>
          <TextInput value={date} onChangeText={setDate} style={shared.input} placeholder="YYYY-MM-DD" />
        </View>

        <View style={shared.panel}>
          <Pressable onPress={() => setShowForm(!showForm)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={shared.sectionTitle}>{editingId ? t("common.edit") : t("food.addManual")}</Text>
            <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 20 }}>{showForm ? "−" : "+"}</Text>
          </Pressable>

          {showForm && (
            <View style={{ marginTop: 12, gap: 12 }}>
              <Text style={shared.label}>{t("food.meal")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {categories.map((item) => (
                  <Pressable key={item} onPress={() => setCategory(item)} style={[shared.secondaryButton, category === item && { backgroundColor: colors.mint, borderColor: colors.leaf }]}>
                    <Text style={[shared.secondaryButtonText, category === item && { fontWeight: "700" }]}>{t(`food.${item}` as any)}</Text>
                  </Pressable>
                ))}
              </View>

              {field(t("common.name"), form.name, (name) => setForm({ ...form, name }))}

              <View style={shared.row}>
                <View style={shared.flex}>{field(t("common.calories"), form.calories, (calories) => setForm({ ...form, calories }), "numeric")}</View>
                <View style={shared.flex}>{field(t("food.macroProtein"), form.protein, (protein) => setForm({ ...form, protein }), "numeric")}</View>
              </View>
              <View style={shared.row}>
                <View style={shared.flex}>{field(t("food.macroCarbs"), form.carbs, (carbs) => setForm({ ...form, carbs }), "numeric")}</View>
                <View style={shared.flex}>{field(t("food.macroFat"), form.fat, (fat) => setForm({ ...form, fat }), "numeric")}</View>
              </View>

              {field(t("common.notes"), form.notes, (notes) => setForm({ ...form, notes }))}

              <View style={shared.row}>
                {editingId ? (
                  <Pressable style={[shared.secondaryButton, shared.flex]} onPress={cancelEdit}>
                    <Text style={shared.secondaryButtonText}>{t("common.cancel")}</Text>
                  </Pressable>
                ) : (
                  <Pressable disabled={busy} style={[shared.secondaryButton, shared.flex, busy && { opacity: 0.6 }]} onPress={() => void estimate()}>
                    <Text style={shared.secondaryButtonText}>{t("food.estimateNutrition")}</Text>
                  </Pressable>
                )}
                <Pressable disabled={busy} style={[shared.primaryButton, shared.flex, busy && { opacity: 0.6 }]} onPress={() => void save()}>
                  {busy ? <ActivityIndicator color="white" /> : <Text style={shared.primaryButtonText}>{t("common.save")}</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {nutritionSummary ? <NutritionStructurePanel summary={nutritionSummary} t={t} /> : null}

        <View style={shared.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={shared.sectionTitle}>{t("food.dailyTotal")}</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: colors.leaf }}>{total} kcal</Text>
              <Text style={{ fontSize: 12, color: "#64748B" }}>
                {calorieTarget ? `${t("food.dailyTarget")}: ${calorieTarget} kcal` : t("food.profileNeeded")}
              </Text>
            </View>
          </View>

          {isOverTarget ? (
            <View style={{ backgroundColor: "#FEF2F2", borderColor: "#FCA5A5", borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: "#991B1B", fontWeight: "700", fontSize: 14 }}>
                {t("food.overTarget")} {excess} kcal
              </Text>
            </View>
          ) : calorieTarget ? (
            <View style={{ backgroundColor: "#ECFDF5", borderColor: "#6EE7B7", borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: "#065F46", fontWeight: "700", fontSize: 14 }}>
                {t("food.remainingToday")} {remaining} kcal
              </Text>
            </View>
          ) : null}

          {logs.length === 0 ? (
            <EmptyState message={t("food.empty")} />
          ) : (
            categories.map((item) => {
              const mealLogs = logs.filter((log) => log.mealCategory === item);
              if (mealLogs.length === 0) return null;
              return (
                <View key={item} style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", textTransform: "capitalize", marginBottom: 8 }}>{t(`food.${item}` as any)}</Text>
                  {mealLogs.map((log) => (
                    <View key={log.id} style={{ borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 8, paddingBottom: 8, gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                          {locale === "zh-CN" ? log.nameZh ?? log.nameEn : log.nameEn}
                        </Text>
                        <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 14 }}>{log.calories ?? 0} kcal</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: "#64748B" }}>
                        P {log.proteinGrams ?? 0}g · C {log.carbsGrams ?? 0}g · F {log.fatGrams ?? 0}g
                      </Text>
                      {log.notes ? <Text style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>{log.notes}</Text> : null}
                      <View style={[shared.row, { marginTop: 4 }]}>
                        <Pressable disabled={busy} onPress={() => startEdit(log)} style={{ marginRight: 16 }}>
                          <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 12 }}>{t("common.edit")}</Text>
                        </Pressable>
                        <Pressable disabled={busy} onPress={() => void remove(log.id)}>
                          <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 12 }}>{t("common.delete")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
