import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppErrorLogView, ServiceStatusItem, ServiceStatusResponse } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { EmptyState } from "../../src/ui/EmptyState";

function StatusBadge({ state, t }: { state: ServiceStatusItem["state"]; t: (k: any) => string }) {
  const color = state === "ok" ? "#059669" : state === "warning" ? "#D97706" : "#E11D48";
  const bg = state === "ok" ? "#ECFDF5" : state === "warning" ? "#FFFBEB" : "#FFF1F2";
  return (
    <View style={{ backgroundColor: bg, borderColor: color, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{t(`status.${state}`)}</Text>
    </View>
  );
}

function ErrorLogCard({ log, locale, t }: { log: AppErrorLogView; locale: string; t: (k: any) => string }) {
  const date = new Date(log.createdAt).toLocaleString(locale);
  const color = log.severity === "error" ? "#E11D48" : log.severity === "warning" ? "#D97706" : "#0EA5E9";
  const bg = log.severity === "error" ? "#FFF1F2" : log.severity === "warning" ? "#FFFBEB" : "#F0F9FF";

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 12, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 11, color: "#64748B" }}>{date}</Text>
        <View style={{ backgroundColor: bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color, textTransform: "uppercase" }}>{log.severity}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{log.message}</Text>
      <Text style={{ fontSize: 12, color: "#64748B" }}>{t("status.errorSource")}: {log.source}</Text>
    </View>
  );
}

export default function StatusScreen() {
  const { adapter, authStatus, locale, t } = useApp();
  const [status, setStatus] = useState<ServiceStatusResponse | null>(null);
  const [errorLogs, setErrorLogs] = useState<AppErrorLogView[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [statusRes, logs] = await Promise.all([
        adapter.getServiceStatus(),
        adapter.getErrorLogs(8).catch(() => [])
      ]);
      setStatus(statusRes);
      setErrorLogs(logs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [adapter, t]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={shared.page} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.header}>
          <Text style={shared.title}>{t("status.title")}</Text>
          <Text style={shared.subtitle}>{t("status.subtitle")}</Text>
        </View>

        {message ? <Text style={shared.error}>{message}</Text> : null}

        <View style={[shared.panel, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
          <View>
            <Text style={shared.sectionTitle}>{t("status.overall")}</Text>
            <View style={{ marginTop: 8 }}>
              {status ? <StatusBadge state={status.overall} t={t} /> : <Text style={shared.helper}>{t("common.loading")}</Text>}
            </View>
          </View>
          <Pressable onPress={() => void load()} disabled={loading} style={[shared.secondaryButton, { paddingVertical: 8 }]}>
            {loading ? <ActivityIndicator size="small" color={colors.leaf} /> : <Text style={shared.secondaryButtonText}>{t("status.refresh")}</Text>}
          </Pressable>
        </View>

        {status?.items.map((item) => (
          <View key={item.id} style={shared.panel}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={shared.sectionTitle}>{locale === "zh-CN" ? item.titleZh : item.titleEn}</Text>
                <Text style={[shared.helper, { marginTop: 4 }]}>{locale === "zh-CN" ? item.summaryZh : item.summaryEn}</Text>
              </View>
              <StatusBadge state={item.state} t={t} />
            </View>
            <View style={{ marginTop: 12, gap: 4 }}>
              {(locale === "zh-CN" ? item.detailsZh : item.detailsEn).map((detail, idx) => (
                <Text key={idx} style={{ fontSize: 13, color: "#64748B" }}>• {detail}</Text>
              ))}
            </View>
          </View>
        ))}

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("status.recentErrors")}</Text>
          <Text style={shared.helper}>{t("status.recentErrorsSubtitle")}</Text>
          <View style={{ marginTop: 8 }}>
            {errorLogs.length > 0 ? (
              errorLogs.map((log) => (
                <ErrorLogCard key={log.id} log={log} locale={locale} t={t} />
              ))
            ) : (
              <EmptyState message={t("status.noRecentErrors")} />
            )}
          </View>
        </View>

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{t("me.connectionMode")}: {adapter.mode}</Text>
          <Text style={[shared.helper, { marginTop: 4 }]}>
            Subscribed: {String(authStatus.subscribed)} · Local mirror: {String(authStatus.localMirror)}
          </Text>
          <Text style={[shared.helper, { marginTop: 8 }]}>
            {t("settings.privacy")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
