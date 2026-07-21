import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { WaterSummary } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { isoToday, numeric, recentIsoDates } from "../../src/utils/date";

export default function WaterScreen() {
  const { adapter, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [water, setWater] = useState<WaterSummary | null>(null);
  const [recent, setRecent] = useState<WaterSummary[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const summary = await adapter.getWater(date);
      setWater(summary);
      setTarget(String(summary.targetMl));

      const summaries = await Promise.all(recentIsoDates(7).map((item) => adapter.getWater(item)));
      setRecent(summaries);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }, [adapter, date, t]);

  useEffect(() => { void load(); }, [load]);

  async function update(operation: () => Promise<WaterSummary>) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await operation();
      setWater(next);
      setTarget(String(next.targetMl));
      const summaries = await Promise.all(recentIsoDates(7).map((item) => adapter.getWater(item)));
      setRecent(summaries);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset() {
    Alert.alert(t("common.reset"), t("common.confirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.reset"), style: "destructive", onPress: () => void update(() => adapter.resetWater(date)) }
    ]);
  }

  const percent = Math.min(100, ((water?.totalMl ?? 0) / Math.max(1, water?.targetMl ?? 2000)) * 100);

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={shared.header}>
          <Text style={shared.title}>{t("water.title")}</Text>
          <Text style={shared.subtitle}>{t("dashboard.subtitle")}</Text>
        </View>

        {message ? <Text style={shared.error}>{message}</Text> : null}

        <View style={shared.panel}>
          <Text style={shared.label}>{t("common.date")}</Text>
          <TextInput value={date} onChangeText={setDate} style={shared.input} placeholder="YYYY-MM-DD" />
        </View>

        <View style={shared.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <Text style={{ fontSize: 32, fontWeight: "800", color: colors.leaf }}>{water?.totalMl ?? 0}</Text>
            <Text style={{ fontSize: 16, color: "#64748B", fontWeight: "600" }}>/ {water?.targetMl ?? 2000} ml</Text>
          </View>

          <View style={{ height: 16, borderRadius: 8, backgroundColor: colors.mint, overflow: "hidden", marginBottom: 20 }}>
            <View style={{ height: "100%", width: `${percent}%`, backgroundColor: colors.leaf }} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {[200, 250, 350, 500].map((amount) => (
              <Pressable key={amount} disabled={busy} style={[shared.secondaryButton, { flex: 1, minWidth: "45%", paddingVertical: 12 }]} onPress={() => void update(() => adapter.addWater({ date, amountMl: amount }))}>
                <Text style={[shared.secondaryButtonText, { fontSize: 15 }]}>+{amount} ml</Text>
              </Pressable>
            ))}
          </View>

          <Text style={shared.label}>{t("water.changeTarget")}</Text>
          <View style={[shared.row, { gap: 10 }]}>
            <TextInput value={target} onChangeText={setTarget} keyboardType="numeric" style={[shared.input, { flex: 1, marginBottom: 0 }]} />
            <Pressable disabled={busy} style={[shared.primaryButton, { flex: 0, paddingHorizontal: 20 }]} onPress={() => void update(() => adapter.setWaterTarget({ date, targetMl: numeric(target) ?? 2000 }))}>
              <Text style={shared.primaryButtonText}>{t("common.save")}</Text>
            </Pressable>
          </View>

          <Pressable disabled={busy} onPress={() => void confirmReset()} style={{ marginTop: 16, alignSelf: "center" }}>
            <Text style={{ color: colors.danger, fontWeight: "700" }}>{t("water.resetToday")}</Text>
          </Pressable>
        </View>

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("water.history")}</Text>
          <View style={{ marginTop: 8, gap: 10 }}>
            {recent.map((item) => (
              <View key={item.date} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{item.date === isoToday() ? t("common.today") : item.date}</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.leaf, fontWeight: "700" }}>{item.totalMl} ml</Text>
                  <Text style={{ fontSize: 11, color: "#64748B" }}>Target: {item.targetMl} ml</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
