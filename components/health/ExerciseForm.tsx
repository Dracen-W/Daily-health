"use client";

import { useEffect, useState } from "react";
import type { ExerciseLogView } from "@/lib/types/domain";
import { useApp } from "@/lib/i18n/I18nProvider";

type ExerciseFormState = {
  id?: string;
  type: string;
  durationMinutes: string;
  estimatedCaloriesBurned: string;
  notes: string;
};

const emptyExercise: ExerciseFormState = {
  type: "Running",
  durationMinutes: "",
  estimatedCaloriesBurned: "",
  notes: ""
};

export function ExerciseForm({
  editing,
  onSubmit,
  onCancel
}: {
  editing: ExerciseLogView | null;
  onSubmit: (value: ExerciseFormState) => void;
  onCancel: () => void;
}) {
  const { t } = useApp();
  const [form, setForm] = useState<ExerciseFormState>(emptyExercise);

  useEffect(() => {
    setForm(
      editing
        ? {
            id: editing.id,
            type: editing.type,
            durationMinutes: editing.durationMinutes.toString(),
            estimatedCaloriesBurned: editing.estimatedCaloriesBurned?.toString() ?? "",
            notes: editing.notes ?? ""
          }
        : emptyExercise
    );
  }, [editing]);

  return (
    <form
      className="panel grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
        if (!editing) setForm(emptyExercise);
      }}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1">
          <span className="field-label">{t("exercise.type")}</span>
          <select className="field-input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="Running">{t("exercise.running")}</option>
            <option value="Basketball">{t("exercise.basketball")}</option>
            <option value="Gym Training">{t("exercise.gym")}</option>
            <option value="Walking">{t("exercise.walking")}</option>
            <option value="Cycling">{t("exercise.cycling")}</option>
            <option value="Swimming">{t("exercise.swimming")}</option>
            <option value="Other">{t("exercise.other")}</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("exercise.duration")}</span>
          <input className="field-input" required min="0" type="number" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("exercise.caloriesBurned")}</span>
          <input className="field-input" min="0" type="number" value={form.estimatedCaloriesBurned} onChange={(event) => setForm({ ...form, estimatedCaloriesBurned: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("common.notes")}</span>
          <input className="field-input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" type="submit">
          {editing ? t("common.update") : t("common.add")}
        </button>
        {editing ? (
          <button className="btn-secondary" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
