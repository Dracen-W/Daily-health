import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { calculateHealthScore } from "../../../../lib/services/healthScore";
import type { DailyHistoryView, UserProfileView } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { HealthScorePanel } from "../../src/ui/HealthScorePanel";
import { HealthTrendChart, type HealthTrendPoint } from "../../src/ui/HealthTrendChart";
import { isoToday, recentIsoDates } from "../../src/utils/date";

export default function HomeScreen() {
  const { adapter, t, initialized, initError, activateLocalMode } = useApp();
  const [history, setHistory] = useState<DailyHistoryView | null>(null);
  const [profile, setProfile] = useState<UserProfileView | null>(null);
  const [recentHistories, setRecentHistories] = useState<DailyHistoryView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!initialized || initError) return;
    console.log("HomeScreen: Starting load...");
    setLoading(true);
    setError(null);
    try {
      const today = isoToday();
      const [todayHistory, nextProfile] = await Promise.all([
        adapter.getHistory(today),
        adapter.getProfile()
      ]);

      setHistory(todayHistory);
      setProfile(nextProfile);

      const dates = recentIsoDates(7).filter(d => d !== today).reverse();
      const otherHistories = await Promise.all(dates.map((date) => adapter.getHistory(date)));
      setRecentHistories([...otherHistories, todayHistory]);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [adapter, t, initialized, initError]);

  useEffect(() => {
    if (initialized && !initError) void load();
  }, [load, initialized, initError]);

  if (!initialized || (loading && !history)) {
    return (
      <SafeAreaView style={shared.page}>
        <View style={[shared.content, { alignItems: "center", paddingTop: 80, gap: 20 }]}>
          <ActivityIndicator size="large" color={colors.leaf} />
          <Text style={shared.helper}>Connecting to service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (initError || (error && !history)) {
    return (
      <SafeAreaView style={shared.page}>
        <View style={[shared.content, { alignItems: "center", paddingTop: 80, gap: 16 }]}>
          <Text style={[shared.error, { textAlign: "center", paddingHorizontal: 20 }]}>{initError || error}</Text>
          <Pressable style={shared.primaryButton} onPress={() => void load()}>
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

  const healthScore = history && profile ? calculateHealthScore({ history, profile }) : null;
  const healthTrendPoints: HealthTrendPoint[] = profile
    ? recentHistories.map((item) => ({
      date: item.date,
      score: calculateHealthScore({ history: item, profile }).score
    }))
    : [];

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.header}>
          <Text style={shared.title}>{t("dashboard.title")}</Text>
          <Text style={shared.subtitle}>{profile?.displayName ? `${t("dashboard.subtitle")} · ${profile.displayName}` : t("dashboard.subtitle")}</Text>
        </View>

        {healthScore ? <HealthScorePanel healthScore={healthScore} t={t} /> : null}

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("dashboard.healthTrend")}</Text>
          <View style={{ marginTop: 12 }}>
            <HealthTrendChart points={healthTrendPoints} t={t} />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[
            [t("dashboard.foodToday"), `${history?.dailyCalories ?? 0} kcal`, `${history?.foodLogs.length ?? 0} ${t("nav.foodLog")}`],
            [t("dashboard.waterToday"), `${history?.water.totalMl ?? 0} ml`, `${history?.water.targetMl ?? 2000} ml ${t("water.target")}`],
            [t("dashboard.exerciseToday"), `${history?.exerciseMinutes ?? 0} min`, `${history?.exerciseLogs.length ?? 0} ${t("nav.exercise")}`]
          ].map(([label, value, detail]) => (
            <View key={label} style={[shared.panel, { flexGrow: 1, flexBasis: "46%", padding: 14, gap: 4 }]}>
              <Text style={shared.helper}>{label}</Text>
              <Text style={{ color: colors.leafDark, fontSize: 22, fontWeight: "700" }}>{value}</Text>
              <Text style={shared.helper}>{detail}</Text>
            </View>
          ))}
        </View>

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("dashboard.weeklySummary")}</Text>
          <View style={{ marginTop: 8, gap: 4 }}>
            <Text style={shared.helper}>{t("food.dailyTotal")}: {history?.dailyCalories ?? 0} kcal</Text>
            <Text style={shared.helper}>{t("water.total")}: {history?.water.totalMl ?? 0} ml</Text>
            <Text style={shared.helper}>{t("exercise.totalMinutes")}: {history?.exerciseMinutes ?? 0}</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push("/(tabs)/smart-scan")} style={StyleSheet.flatten({ marginBottom: 24 })}>
          <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 16 }}>Start a Smart Scan →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
