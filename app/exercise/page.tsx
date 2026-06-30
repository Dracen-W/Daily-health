"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { isoToday } from "@/lib/client/display";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { ExerciseLogView } from "@/lib/types/domain";
import { ExerciseForm } from "@/components/health/ExerciseForm";
import { EmptyState } from "@/components/shared/EmptyState";

type ExerciseFormValue = {
  id?: string;
  type: string;
  durationMinutes: string;
  estimatedCaloriesBurned: string;
  notes: string;
};

export default function ExercisePage() {
  const { profileId, locale, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [logs, setLogs] = useState<ExerciseLogView[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [editing, setEditing] = useState<ExerciseLogView | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    const response = await apiFetch<{ logs: ExerciseLogView[]; totalMinutes: number }>(`/api/exercise?date=${date}`, { profileId, locale });
    setLogs(response.logs);
    setTotalMinutes(response.totalMinutes);
  }, [date, locale, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(value: ExerciseFormValue) {
    if (!profileId) return;
    await apiFetch<{ log: ExerciseLogView }>("/api/exercise", {
      method: value.id ? "PATCH" : "POST",
      profileId,
      locale,
      body: {
        id: value.id,
        profileId,
        type: value.type,
        durationMinutes: Number(value.durationMinutes),
        estimatedCaloriesBurned: value.estimatedCaloriesBurned ? Number(value.estimatedCaloriesBurned) : null,
        date,
        notes: value.notes
      }
    });
    setEditing(null);
    await load();
  }

  async function remove(log: ExerciseLogView) {
    if (!profileId) return;
    await apiFetch<{ deleted: boolean }>("/api/exercise", {
      method: "DELETE",
      profileId,
      locale,
      body: { profileId, id: log.id }
    });
    await load();
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <h1 className="page-title">{t("exercise.title")}</h1>
      </section>
      <label className="grid max-w-xs gap-1">
        <span className="field-label">{t("common.date")}</span>
        <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <ExerciseForm editing={editing} onSubmit={(value) => void submit(value)} onCancel={() => setEditing(null)} />
      <section className="panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("exercise.totalMinutes")}</h2>
          <span className="text-2xl font-semibold text-leaf">{totalMinutes}</span>
        </div>
        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-2">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                <div>
                  <p className="font-medium text-slate-950 dark:text-white">{log.type}</p>
                  <p className="text-sm text-slate-500">{log.durationMinutes} {t("common.minutes")} · {log.estimatedCaloriesBurned ?? 0} kcal</p>
                </div>
                <div className="flex gap-2">
                  <button className="icon-button" type="button" title={t("common.edit")} onClick={() => setEditing(log)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{t("common.edit")}</span>
                  </button>
                  <button className="icon-button" type="button" title={t("common.delete")} onClick={() => void remove(log)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{t("common.delete")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
