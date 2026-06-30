"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { ingredientName, isoToday, mealCategoryKey, recipeTranslation, sleepQualityKey } from "@/lib/client/display";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { DailyHistoryView } from "@/lib/types/domain";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";

export default function HistoryPage() {
  const { profileId, locale, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [history, setHistory] = useState<DailyHistoryView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    const response = await apiFetch<{ history: DailyHistoryView }>(`/api/history/${date}`, { profileId, locale });
    setHistory(response.history);
  }, [date, locale, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteDay() {
    if (!profileId) return;
    await apiFetch<{ deleted: boolean }>(`/api/history/${date}/delete`, {
      method: "DELETE",
      profileId,
      locale,
      body: { profileId }
    });
    setConfirmOpen(false);
    await load();
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <h1 className="page-title">{t("history.title")}</h1>
      </section>
      <label className="grid max-w-xs gap-1">
        <span className="field-label">{t("common.date")}</span>
        <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel">
          <p className="text-sm text-slate-500">{t("food.dailyTotal")}</p>
          <p className="mt-1 text-2xl font-semibold text-leaf">{history?.dailyCalories ?? 0} kcal</p>
        </div>
        <div className="panel">
          <p className="text-sm text-slate-500">{t("water.total")}</p>
          <p className="mt-1 text-2xl font-semibold text-leaf">{history?.water.totalMl ?? 0} ml</p>
        </div>
        <div className="panel">
          <p className="text-sm text-slate-500">{t("exercise.totalMinutes")}</p>
          <p className="mt-1 text-2xl font-semibold text-leaf">{history?.exerciseMinutes ?? 0}</p>
        </div>
      </section>
      <section className="panel grid gap-3">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("food.title")}</h2>
        {history?.foodLogs.length ? history.foodLogs.map((log) => (
          <div key={log.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
            {t(mealCategoryKey(log.mealCategory))}: {ingredientName({ nameEn: log.nameEn, nameZh: log.nameZh ?? "" }, locale)} · {log.calories ?? 0} kcal
          </div>
        )) : <EmptyState />}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">{t("wellness.title")}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("wellness.sleepDuration")}: {history?.sleep ? `${history.sleep.hours} h · ${t(sleepQualityKey(history.sleep.quality))}` : "-"}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t("wellness.weightKg")}: {history?.weight ? `${history.weight.weightKg} kg` : "-"}
          </p>
        </div>
        <div className="panel">
          <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">{t("exercise.title")}</h2>
          {history?.exerciseLogs.length ? history.exerciseLogs.map((log) => (
            <p key={log.id} className="text-sm text-slate-600 dark:text-slate-300">{log.type} · {log.durationMinutes} {t("common.minutes")}</p>
          )) : <EmptyState />}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">{t("history.scans")}</h2>
          {history?.scans.length ? history.scans.map((scan) => (
            <p key={scan.id} className="text-sm text-slate-600 dark:text-slate-300">{scan.ingredients.map((item) => ingredientName(item, locale)).join(", ")}</p>
          )) : <EmptyState />}
        </div>
        <div className="panel">
          <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">{t("history.recipes")}</h2>
          {history?.recipes.length ? history.recipes.map((recipe) => (
            <p key={recipe.id} className="text-sm text-slate-600 dark:text-slate-300">{recipeTranslation(recipe, locale)?.title}</p>
          )) : <EmptyState />}
        </div>
      </section>
      <button className="btn-danger self-start" type="button" onClick={() => setConfirmOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t("history.deleteDay")}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        danger
        title={t("history.deleteDay")}
        message={t("history.confirmDelete")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void deleteDay()}
      />
    </main>
  );
}
