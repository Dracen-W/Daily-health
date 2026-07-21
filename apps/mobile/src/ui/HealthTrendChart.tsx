import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "./styles";

export type HealthTrendPoint = {
  date: string;
  score: number;
};

export function HealthTrendChart({ points, t }: { points: HealthTrendPoint[]; t: (k: any) => string }) {
  if (points.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Text style={styles.emptyText}>{t("dashboard.noTrendData")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {points.map((point, index) => {
        const height = Math.max(10, (point.score / 100) * 100);
        const scoreColor =
          point.score >= 85 ? "#059669" :
          point.score >= 70 ? colors.leaf :
          point.score >= 50 ? "#F59E0B" : "#EF4444";

        return (
          <View key={point.date} style={styles.barContainer}>
            <View style={[styles.bar, { height: height, backgroundColor: scoreColor }]} />
            <Text style={styles.dateText}>{point.date.slice(8)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 140,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
  },
  dateText: {
    fontSize: 9,
    color: "#64748B",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748B",
  },
});
