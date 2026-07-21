import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { WeightLogView } from "../domain";
import { colors } from "./styles";

export function WeightTrendChart({ weights }: { weights: WeightLogView[] }) {
  if (weights.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Text style={styles.emptyText}>-</Text>
      </View>
    );
  }

  const values = weights.map((weight) => weight.weightKg);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const spread = Math.max(max - min, 1);

  return (
    <View style={styles.container}>
      {weights.map((weight) => {
        // Base height 20px, max height roughly 100px mapped into container
        const height = 20 + ((weight.weightKg - min) / spread) * 80;
        return (
          <View key={weight.id} style={styles.barContainer}>
            <View style={[styles.bar, { height: height }]} />
            <Text style={styles.dateText}>{weight.date.slice(5)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 160,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "#F8FAFC", // slate-50 equivalent
    padding: 12,
    borderRadius: 8,
  },
  barContainer: {
    flex: 1,
    minWidth: 32,
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.leaf,
  },
  dateText: {
    fontSize: 10,
    color: "#64748B", // slate-500 equivalent
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#64748B",
  },
});
