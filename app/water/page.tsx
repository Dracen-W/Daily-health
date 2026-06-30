"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { isoToday, recentIsoDates } from "@/lib/client/display";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { WaterSummary } from "@/lib/types/domain";
import { WaterTracker } from "@/components/health/WaterTracker";

export default function WaterPage() {
  const { profileId, locale, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [recent, setRecent] = useState<WaterSummary[]>([]);

  const loadRecent = useCallback(async () => {
    if (!profileId) return;
    const summaries = await Promise.all(
      recentIsoDates(7).map((item) => apiFetch<{ water: WaterSummary }>(`/api/water?date=${item}`, { profileId, locale }).then((response) => response.water))
    );
    setRecent(summaries);
  }, [locale, profileId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  return (
    <main className="page-shell">
      <section className="page-header">
        <h1 className="page-title">{t("water.title")}</h1>
      </section>
      <label className="grid max-w-xs gap-1">
        <span className="field-label">{t("common.date")}</span>
        <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <WaterTracker date={date} onChange={loadRecent} />
      <section className="panel">
        <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">{t("water.history")}</h2>
        <div className="grid gap-2">
          {recent.map((item) => (
            <div key={item.date} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
              <span className="text-slate-700 dark:text-slate-200">{item.date}</span>
              <span className="font-semibold text-leaf">{item.totalMl} / {item.targetMl} ml</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
