"use client";

import { useEffect, useState } from "react";
import type { WeightLogView } from "@/lib/types/domain";
import { useApp } from "@/lib/i18n/I18nProvider";

type WeightFormState = {
  weightKg: string;
  notes: string;
};

export function WeightForm({
  weight,
  onSubmit,
  onDelete
}: {
  weight: WeightLogView | null;
  onSubmit: (value: WeightFormState) => void;
  onDelete: () => void;
}) {
  const { t } = useApp();
  const [form, setForm] = useState<WeightFormState>({ weightKg: "", notes: "" });

  useEffect(() => {
    setForm(weight ? { weightKg: weight.weightKg.toString(), notes: weight.notes ?? "" } : { weightKg: "", notes: "" });
  }, [weight]);

  return (
    <form
      className="panel grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("wellness.weightKg")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="field-label">{t("wellness.weightKg")}</span>
          <input className="field-input" required min="1" max="500" step="0.1" type="number" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("common.notes")}</span>
          <input className="field-input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" type="submit">
          {t("common.save")}
        </button>
        <button className="btn-secondary" type="button" onClick={onDelete}>
          {t("common.delete")}
        </button>
      </div>
    </form>
  );
}
