import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ThemeMode } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { numeric } from "../../src/utils/date";

export default function SettingsScreen() {
  const { adapter, defaultWaterTargetMl, locale, setLocale, setTheme, t, theme } = useApp();
  const [waterTarget, setWaterTarget] = useState(String(defaultWaterTargetMl));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveWaterTarget() {
    setBusy(true);
    try {
      const next = await adapter.saveSettings({ defaultWaterTargetMl: numeric(waterTarget) ?? 0 });
      setWaterTarget(String(next.defaultWaterTargetMl));
      setMessage(t("common.success"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={shared.header}>
          <Text style={shared.title}>{t("settings.title")}</Text>
          <Text style={shared.subtitle}>{t("settings.privacy")}</Text>
        </View>

        {message ? (
          <View style={{ backgroundColor: message === t("common.success") ? "#ECFDF5" : "#FEF2F2", padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ color: message === t("common.success") ? "#065F46" : "#991B1B", fontWeight: "600", fontSize: 13 }}>{message}</Text>
          </View>
        ) : null}

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("settings.language")}</Text>
          <View style={[shared.row, { marginTop: 12 }]}>
            {(["en", "zh-CN"] as const).map((item) => (
              <Pressable key={item} style={[shared.secondaryButton, shared.flex, locale === item && { backgroundColor: colors.mint, borderColor: colors.leaf }]} onPress={() => void setLocale(item)}>
                <Text style={[shared.secondaryButtonText, locale === item && { color: colors.leafDark, fontWeight: "700" }]}>{item === "en" ? "English" : "简体中文"}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("settings.theme")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            {(["light", "dark", "system"] as ThemeMode[]).map((item) => (
              <Pressable key={item} style={[shared.secondaryButton, { flex: 1, minWidth: "30%" }, theme === item && { backgroundColor: colors.mint, borderColor: colors.leaf }]} onPress={() => void setTheme(item)}>
                <Text style={[shared.secondaryButtonText, { textTransform: "capitalize" }, theme === item && { color: colors.leafDark, fontWeight: "700" }]}>{t(`theme.${item}`)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("settings.waterTarget")}</Text>
          <View style={[shared.row, { gap: 10, marginTop: 12 }]}>
            <TextInput value={waterTarget} onChangeText={setWaterTarget} keyboardType="numeric" style={[shared.input, { flex: 1, marginBottom: 0 }]} />
            <Pressable disabled={busy} style={[shared.primaryButton, { flex: 0, paddingHorizontal: 20 }]} onPress={() => void saveWaterTarget()}>
              <Text style={shared.primaryButtonText}>{t("common.save")}</Text>
            </Pressable>
          </View>
          <Text style={[shared.helper, { marginTop: 8 }]}>ml / day</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
