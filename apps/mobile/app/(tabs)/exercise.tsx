import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ExerciseLogView } from "../../src/domain";
import { useApp } from "../../src/state/AppProvider";
import { colors, shared } from "../../src/ui/styles";
import { EmptyState } from "../../src/ui/EmptyState";
import { isoToday, numeric } from "../../src/utils/date";

export default function ExerciseScreen() {
  const { adapter, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [logs, setLogs] = useState<ExerciseLogView[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState("");
  const [minutes, setMinutes] = useState("");
  const [calories, setCalories] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const nextLogs = await adapter.getExercise(date);
      setLogs(nextLogs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }, [adapter, date, t]);

  useEffect(() => { void load(); }, [load]);

  const total = logs.reduce((sum, item) => sum + item.durationMinutes, 0);

  function startEdit(log: ExerciseLogView) {
    setEditingId(log.id);
    setKind(log.type);
    setMinutes(String(log.durationMinutes));
    setCalories(log.estimatedCaloriesBurned ? String(log.estimatedCaloriesBurned) : "");
    setNotes(log.notes ?? "");
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setKind("");
    setMinutes("");
    setCalories("");
    setNotes("");
    setMessage(null);
  }

  async function save() {
    const durationMinutes = numeric(minutes);
    if (!kind.trim() || durationMinutes == null) {
      setMessage("Enter an activity and duration.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await adapter.saveExercise({
        id: editingId ?? undefined,
        type: kind.trim(),
        durationMinutes,
        estimatedCaloriesBurned: numeric(calories),
        date,
        notes: notes || null
      });
      resetForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    Alert.alert(t("common.delete"), t("common.confirmDelete"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await adapter.deleteExercise(id);
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
      <ScrollView contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={shared.header}>
          <Text style={shared.title}>{t("exercise.title")}</Text>
          <Text style={shared.subtitle}>{total} {t("common.minutes")} {t("exercise.totalMinutes").toLowerCase()}</Text>
        </View>

        {message ? <Text style={shared.error}>{message}</Text> : null}

        <View style={shared.panel}>
          <Text style={shared.label}>{t("common.date")}</Text>
          <TextInput value={date} onChangeText={setDate} style={shared.input} placeholder="YYYY-MM-DD" />
        </View>

        <View style={shared.panel}>
          <Text style={shared.sectionTitle}>{editingId ? t("common.edit") : t("common.add")}</Text>
          <TextInput value={kind} onChangeText={setKind} style={shared.input} placeholder={t("exercise.type")} />
          <View style={shared.row}>
            <TextInput value={minutes} onChangeText={setMinutes} keyboardType="numeric" style={[shared.input, shared.flex]} placeholder={t("exercise.duration")} />
            <TextInput value={calories} onChangeText={setCalories} keyboardType="numeric" style={[shared.input, shared.flex]} placeholder={t("exercise.caloriesBurned")} />
          </View>
          <TextInput value={notes} onChangeText={setNotes} style={shared.input} placeholder={t("common.notes")} />
          <View style={shared.row}>
            {editingId ? (
              <Pressable style={[shared.secondaryButton, shared.flex]} onPress={resetForm}>
                <Text style={shared.secondaryButtonText}>{t("common.cancel")}</Text>
              </Pressable>
            ) : null}
            <Pressable disabled={busy} style={[shared.primaryButton, shared.flex, busy && { opacity: 0.6 }]} onPress={() => void save()}>
              {busy ? <ActivityIndicator color="white" /> : <Text style={shared.primaryButtonText}>{t("common.save")}</Text>}
            </Pressable>
          </View>
        </View>

        <View style={shared.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={shared.sectionTitle}>{t("exercise.totalMinutes")}</Text>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.leaf }}>{total}</Text>
          </View>

          {logs.length === 0 ? (
            <EmptyState message={t("common.empty")} />
          ) : (
            logs.map((log) => (
              <View key={log.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, paddingBottom: 8, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{log.type}</Text>
                  <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 15 }}>{log.durationMinutes} {t("common.minutes")}</Text>
                </View>
                <Text style={shared.helper}>
                  {log.estimatedCaloriesBurned ?? 0} kcal {log.notes ? `· ${log.notes}` : ""}
                </Text>
                <View style={[shared.row, { marginTop: 4 }]}>
                  <Pressable onPress={() => startEdit(log)} style={{ marginRight: 16 }}>
                    <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 13 }}>{t("common.edit")}</Text>
                  </Pressable>
                  <Pressable onPress={() => void remove(log.id)}>
                    <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 13 }}>{t("common.delete")}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
