"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { ingredientName, isoToday, mealCategoryKey } from "@/lib/client/display";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { FoodLogView, MealCategory } from "@/lib/types/domain";
import { FoodLogForm } from "@/components/health/FoodLogForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { Toast, type ToastState } from "@/components/shared/Toast";

type FormValue = {
  id?: string;
  nameEn: string;
  nameZh: string;
  calories: string;
  notes: string;
  mealCategory: MealCategory;
};

const categories: MealCategory[] = ["breakfast", "lunch", "dinner", "snack"];

export default function FoodLogPage() {
  const { profileId, locale, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [logs, setLogs] = useState<FoodLogView[]>([]);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<FoodLogView | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  function showToast(message: string, type: "success" | "error" | "info" = "info") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    if (!profileId) return;
    const response = await apiFetch<{ logs: FoodLogView[]; total: number }>(`/api/food-logs?date=${date}`, { profileId, locale });
    setLogs(response.logs);
    setTotal(response.total);
  }, [date, locale, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(value: FormValue) {
    if (!profileId) return;
    try {
      await apiFetch<{ log: FoodLogView }>("/api/food-logs", {
        method: value.id ? "PATCH" : "POST",
        profileId,
        locale,
        body: {
          id: value.id,
          profileId,
          date,
          mealCategory: value.mealCategory,
          nameEn: value.nameEn,
          nameZh: value.nameZh,
          calories: value.calories ? Number(value.calories) : null,
          notes: value.notes,
          sourceType: "manual"
        }
      });
      setEditing(null);
      showToast(t("common.success"), "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    }
  }

  async function remove(log: FoodLogView) {
    if (!profileId) return;
    await apiFetch<{ deleted: boolean }>("/api/food-logs", {
      method: "DELETE",
      profileId,
      locale,
      body: { profileId, id: log.id }
    });
    await load();
  }

  return (
    <main className="page-shell">
      <Toast toast={toast} />
      <section className="page-header">
        <h1 className="page-title">{t("food.title")}</h1>
      </section>
      <label className="grid max-w-xs gap-1">
        <span className="field-label">{t("common.date")}</span>
        <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <FoodLogForm editing={editing} onSubmit={(value) => void submit(value)} onCancel={() => setEditing(null)} />
      <section className="panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("food.dailyTotal")}</h2>
          <span className="text-2xl font-semibold text-leaf">{total} kcal</span>
        </div>
        {logs.length === 0 ? (
          <EmptyState message={t("food.empty")} />
        ) : (
          <div className="grid gap-4">
            {categories.map((category) => {
              const items = logs.filter((log) => log.mealCategory === category);
              return (
                <section key={category} className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                  <h3 className="font-semibold text-slate-950 dark:text-white">{t(mealCategoryKey(category))}</h3>
                  <div className="mt-2 grid gap-2">
                    {items.map((log) => (
                      <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-3 dark:bg-slate-900">
                        <div>
                          <p className="font-medium text-slate-950 dark:text-white">{ingredientName({ nameEn: log.nameEn, nameZh: log.nameZh ?? "" }, locale)}</p>
                          <p className="text-sm text-slate-500">{log.calories ?? 0} kcal · {log.notes}</p>
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
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
