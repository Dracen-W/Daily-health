import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "./styles";

export function EmptyState({ message }: { message?: string }) {
  return (
    <View style={styles.container}>
      <Text style={{ fontSize: 24, marginBottom: 12 }}>🍃</Text>
      <Text style={styles.text}>{message || "No records yet."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  text: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },
});
