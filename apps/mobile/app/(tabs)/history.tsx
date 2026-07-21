import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DailyHistoryView } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { ingredientName, mealCategoryKey, recipeTranslation } from "../../src/ui/display";
import { EmptyState } from "../../src/ui/EmptyState";
import { isoToday } from "../../src/utils/date";

export default function HistoryScreen() {
  const { adapter, locale, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [history, setHistory] = useState<DailyHistoryView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const current = await adapter.getHistory(date);
      setHistory(current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }, [adapter, date, t]);

  useEffect(() => { void load(); }, [load]);

  async function deleteDay() {
    Alert.alert(t("history.deleteDay"), t("history.confirmDelete"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await adapter.deleteHistory(date);
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : t("common.error"));
          } finally {
            setBusy(false);
          }
        }
      }
    ]);
  }

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.header}>
          <Text style={shared.title}>{t("history.title")}</Text>
          <Text style={shared.subtitle}>{t("dashboard.subtitle")}</Text>
        </View>

        {message ? <Text style={shared.error}>{message}</Text> : null}

        <View style={shared.panel}>
          <Text style={shared.label}>{t("common.date")}</Text>
          <TextInput value={date} onChangeText={setDate} style={shared.input} placeholder="YYYY-MM-DD" />
        </View>

        {busy && !history ? (
          <ActivityIndicator color={colors.leaf} style={{ marginTop: 24 }} />
        ) : history ? (
          <>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <View style={[shared.panel, { flex: 1, minWidth: "30%" }]}>
                <Text style={{ fontSize: 12, color: "#64748B" }}>{t("food.dailyTotal")}</Text>
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.leaf, marginTop: 4 }}>{history.dailyCalories} kcal</Text>
              </View>
              <View style={[shared.panel, { flex: 1, minWidth: "30%" }]}>
                <Text style={{ fontSize: 12, color: "#64748B" }}>{t("water.total")}</Text>
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.leaf, marginTop: 4 }}>{history.water.totalMl} ml</Text>
              </View>
              <View style={[shared.panel, { flex: 1, minWidth: "30%" }]}>
                <Text style={{ fontSize: 12, color: "#64748B" }}>{t("exercise.totalMinutes")}</Text>
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.leaf, marginTop: 4 }}>{history.exerciseMinutes}</Text>
              </View>
            </View>

            <View style={shared.panel}>
              <Text style={shared.sectionTitle}>{t("food.title")}</Text>
              {history.foodLogs.length > 0 ? history.foodLogs.map((log) => (
                <View key={log.id} style={{ backgroundColor: "#F8FAFC", padding: 12, borderRadius: 8, marginTop: 8 }}>
                  <Text style={{ fontSize: 14, color: colors.text }}>
                    {t(mealCategoryKey(log.mealCategory))}: {ingredientName({ nameEn: log.nameEn, nameZh: log.nameZh }, locale)} · {log.calories ?? 0} kcal
                  </Text>
                </View>
              )) : <EmptyState message={t("common.empty")} />}
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[shared.panel, { flex: 1 }]}>
                <Text style={shared.sectionTitle}>{t("exercise.title")}</Text>
                {history.exerciseLogs.length > 0 ? history.exerciseLogs.map((log) => (
                  <Text key={log.id} style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                    {log.type} · {log.durationMinutes} {t("common.minutes")}
                  </Text>
                )) : <EmptyState message={t("common.empty")} />}
              </View>
            </View>

            <View style={[shared.panel]}>
              <Text style={shared.sectionTitle}>{t("history.scans")}</Text>
              {history.scans.length > 0 ? history.scans.map((scan) => (
                <Text key={scan.id} style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                  {scan.ingredients.map((item) => ingredientName(item, locale)).join(", ")}
                </Text>
              )) : <EmptyState message={t("common.empty")} />}
            </View>

            <View style={[shared.panel]}>
              <Text style={shared.sectionTitle}>{t("history.recipes")}</Text>
              {history.recipes.length > 0 ? history.recipes.map((recipe) => (
                <Text key={recipe.id} style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                  {recipeTranslation(recipe, locale)?.title}
                </Text>
              )) : <EmptyState message={t("common.empty")} />}
            </View>

            <Pressable onPress={() => void deleteDay()} style={[shared.secondaryButton, { borderColor: colors.danger, marginTop: 12 }]}>
              <Text style={{ color: colors.danger, fontWeight: "700", textAlign: "center" }}>{t("history.deleteDay")}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
