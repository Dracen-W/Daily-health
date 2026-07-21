import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, Alert, Platform, StyleSheet } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";

export default function MeScreen() {
  const { adapter, authStatus, t } = useApp();
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const backup = await adapter.exportBackup();
      if (Platform.OS === "web") {
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `daily-health-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Export", "Local SQLite backup to file system is being prepared for Native. On the web, you can download it directly.");
      }
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function importData() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        setBusy(true);
        try {
          const text = await file.text();
          const backup = JSON.parse(text);
          const result = await adapter.importBackup(backup);
          Alert.alert("Success", `Imported ${result.summary.records} records. Refreshing app...`);
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        } catch (error) {
          Alert.alert("Import failed", error instanceof Error ? error.message : "Invalid backup file");
        } finally {
          setBusy(false);
        }
      };
      input.click();
    } else {
      Alert.alert("Import", "Local SQLite import from file system is being prepared for Native.");
    }
  }

  const toolLinks = [
    {
      href: "/(tabs)/profile",
      titleKey: "me.profile",
      detailKey: "me.profileDetail",
      icon: "user"
    },
    {
      href: "/(tabs)/status",
      titleKey: "me.status",
      detailKey: "me.statusDetail",
      icon: "server"
    },
    {
      href: "/(tabs)/settings",
      titleKey: "me.settings",
      detailKey: "me.settingsDetail",
      icon: "gear"
    }
  ] as const;

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.header}>
          <Text style={shared.title}>{t("me.title")}</Text>
          <Text style={shared.subtitle}>{t("me.subtitle")}</Text>
        </View>

        <View style={{ gap: 12 }}>
          {toolLinks.map((item) => (
            <Pressable key={item.href} onPress={() => router.push(item.href as any)} style={StyleSheet.flatten([shared.panel, { flexDirection: "row", alignItems: "center", gap: 16, padding: 20 }])}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }}>
                <FontAwesome6 name={item.icon} size={20} color={colors.leaf} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>{t(item.titleKey)}</Text>
                <Text style={StyleSheet.flatten([shared.helper, { marginTop: 4, fontSize: 14 }])}>{t(item.detailKey)}</Text>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color="#CBD5E1" />
            </Pressable>
          ))}
        </View>

        <View style={shared.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={shared.sectionTitle}>{t("me.connectionTitle")}</Text>
            <Pressable onPress={() => void adapter.ensureProfile().then(() => Alert.alert(t("common.success"), "Profile synced."))}>
              <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 13 }}>{t("me.refreshConnection")}</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={shared.helper}>{t("me.connectionMode")}</Text>
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, textTransform: "capitalize" }}>{adapter.mode}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={shared.helper}>Cloud Sync</Text>
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{authStatus.subscribed ? "Enabled" : "Disabled"}</Text>
            </View>
          </View>
        </View>

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("me.localProfile")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20 }}>🆔</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: "#64748B", fontFamily: "monospace" }}>{authStatus.profileId}</Text>
              <Text style={[shared.helper, { marginTop: 2 }]}>
                {authStatus.subscribed ? "Cloud account active" : "Local mode only"}
              </Text>
            </View>
          </View>
        </View>

        <View style={shared.panel}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <FontAwesome6 name="database" size={18} color={colors.leaf} />
            <Text style={shared.sectionTitle}>{t("me.backupTitle")}</Text>
          </View>
          <Text style={[shared.helper, { marginBottom: 16 }]}>
            {t("settings.privacy")}
          </Text>

          <View style={{ gap: 10 }}>
            <Pressable
              disabled={busy}
              style={[shared.primaryButton, { backgroundColor: colors.leaf }, busy && { opacity: 0.6 }]}
              onPress={() => void exportData()}
            >
              {busy ? <ActivityIndicator color="white" /> : <Text style={shared.primaryButtonText}>{t("me.exportData")}</Text>}
            </Pressable>

            <Pressable
              disabled={busy}
              style={[shared.secondaryButton, busy && { opacity: 0.6 }]}
              onPress={() => void importData()}
            >
              <Text style={shared.secondaryButtonText}>{t("me.importData")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
