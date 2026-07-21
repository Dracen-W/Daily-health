import React from "react";
import { View, Text } from "react-native";
import type { HealthScoreView } from "../../../../lib/services/healthScore";
import { colors, shared } from "./styles";

export function HealthScorePanel({ healthScore, t }: { healthScore: HealthScoreView; t: (k: string) => string }) {
  const scoreColor =
    healthScore.score >= 85 ? "#059669" :
    healthScore.score >= 70 ? colors.leaf :
    healthScore.score >= 50 ? "#D97706" : "#E11D48";

  return (
    <View style={shared.panel}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={shared.sectionTitle}>{t("dashboard.healthScore")}</Text>
          <Text style={{ fontSize: 40, fontWeight: "800", color: scoreColor, marginTop: 4 }}>
            {healthScore.score}
          </Text>
          <Text style={shared.helper}>{t("dashboard.scoreOutOf100")}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{t(healthScore.statusKey)}</Text>
          <View style={{ marginTop: 8, gap: 4 }}>
            {healthScore.adviceKeys.map((key: string, idx: number) => (
              <Text key={idx} style={{ fontSize: 12, color: "#64748B" }}>• {t(key)}</Text>
            ))}
          </View>
        </View>
      </View>

      <View style={{ marginTop: 20, gap: 12 }}>
        {healthScore.metrics.map((metric: any) => (
          <View key={metric.key}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 13, color: colors.text }}>{t(metric.labelKey)}</Text>
              <Text style={{ fontSize: 12, color: "#64748B" }}>{metric.value}</Text>
            </View>
            <View style={{ height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
              <View style={{
                height: "100%",
                width: `${metric.percent}%`,
                backgroundColor: metric.tone === "good" ? colors.leaf : metric.tone === "warning" ? "#F59E0B" : "#EF4444"
              }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
