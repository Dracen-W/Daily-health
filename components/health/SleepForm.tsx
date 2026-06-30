"use client";

import { useEffect, useState } from "react";
import type { SleepLogView, SleepQuality } from "@/lib/types/domain";
import { useApp } from "@/lib/i18n/I18nProvider";

type SleepFormState = {
  hours: string;
  quality: SleepQuality;
  notes: string;
};

export function SleepForm({
  sleep,
  onSubmit,
  onDelete
}: {
  sleep: SleepLogView | null;
  onSubmit: (value: SleepFormState) => void;
  onDelete: () => void;
}) {
  const { t } = useApp();
  const [form, setForm] = useState<SleepFormState>({ hours: "", quality: "average", notes: "" });

  useEffect(() => {
    setForm(
      sleep
        ? { hours: sleep.hours.toString(), quality: sleep.quality, notes: sleep.notes ?? "" }
        : { hours: "", quality: "average", notes: "" }
    );
  }, [sleep]);

  return (
    <form
      className="panel grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("wellness.sleepDuration")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1">
          <span className="field-label">{t("wellness.sleepDuration")}</span>
          <input className="field-input" required type="number" min="0" max="24" step="0.1" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("wellness.sleepQuality")}</span>
          <select className="field-input" value={form.quality} onChange={(event) => setForm({ ...form, quality: event.target.value as SleepQuality })}>
            <option value="poor">{t("wellness.poor")}</option>
            <option value="average">{t("wellness.average")}</option>
            <option value="good">{t("wellness.good")}</option>
          </select>
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
