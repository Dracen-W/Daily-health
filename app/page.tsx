"use client";

import { Activity, Droplets, Moon, Scale, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { isoToday, sleepQualityKey } from "@/lib/client/display";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { DailyHistoryView, SleepLogView, WeightLogView } from "@/lib/types/domain";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { WeightTrendChart } from "@/components/dashboard/WeightTrendChart";
import { LoadingState } from "@/components/shared/LoadingState";

export default function HomePage() {
  const { profileId, locale, t } = useApp();
  const [history, setHistory] = useState<DailyHistoryView | null>(null);
  const [latestSleep, setLatestSleep] = useState<SleepLogView | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightLogView | null>(null);
  const [weights, setWeights] = useState<WeightLogView[]>([]);
  const [loading, setLoading] = useState(true);
  const today = isoToday();

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    Promise.all([
      apiFetch<{ history: DailyHistoryView }>(`/api/history/${today}`, { profileId, locale }),
      apiFetch<{ sleep: SleepLogView | null }>("/api/sleep?latest=1", { profileId, locale }),
      apiFetch<{ weight: WeightLogView | null }>("/api/weight?latest=1", { profileId, locale }),
      apiFetch<{ weights: WeightLogView[] }>("/api/weight?recent=1", { profileId, locale })
    ])
      .then(([historyResponse, sleepResponse, weightResponse, weightsResponse]) => {
        setHistory(historyResponse.history);
        setLatestSleep(sleepResponse.sleep);
        setLatestWeight(weightResponse.weight);
        setWeights(weightsResponse.weights);
      })
      .finally(() => setLoading(false));
  }, [locale, profileId, today]);

  if (loading) {
    return (
      <main className="page-shell">
        <LoadingState />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <h1 className="page-title">{t("dashboard.title")}</h1>
        <p className="page-subtitle">{t("dashboard.subtitle")}</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard
          title={t("dashboard.foodToday")}
          value={`${history?.dailyCalories ?? 0} kcal`}
          detail={`${history?.foodLogs.length ?? 0} ${t("nav.foodLog")}`}
          icon={<Utensils className="h-5 w-5" aria-hidden="true" />}
        />
        <DashboardCard
          title={t("dashboard.waterToday")}
          value={`${history?.water.totalMl ?? 0} ml`}
          detail={`${history?.water.targetMl ?? 2000} ml ${t("water.target")}`}
          icon={<Droplets className="h-5 w-5" aria-hidden="true" />}
        />
        <DashboardCard
          title={t("dashboard.exerciseToday")}
          value={`${history?.exerciseMinutes ?? 0} ${t("common.minutes")}`}
          detail={`${history?.exerciseLogs.length ?? 0} ${t("nav.exercise")}`}
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        />
        <DashboardCard
          title={t("dashboard.sleepLatest")}
          value={latestSleep ? `${latestSleep.hours} h` : "-"}
          detail={latestSleep ? `${latestSleep.date} · ${t(sleepQualityKey(latestSleep.quality))}` : t("common.empty")}
          icon={<Moon className="h-5 w-5" aria-hidden="true" />}
        />
        <DashboardCard
          title={t("dashboard.weightLatest")}
          value={latestWeight ? `${latestWeight.weightKg} kg` : "-"}
          detail={latestWeight?.date ?? t("common.empty")}
          icon={<Scale className="h-5 w-5" aria-hidden="true" />}
        />
      </section>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("dashboard.weeklySummary")}</h2>
          <WeeklySummary
            items={[
              { label: t("food.dailyTotal"), value: `${history?.dailyCalories ?? 0} kcal` },
              { label: t("water.total"), value: `${history?.water.totalMl ?? 0} ml` },
              { label: t("exercise.totalMinutes"), value: `${history?.exerciseMinutes ?? 0}` }
            ]}
          />
        </section>
        <section className="panel">
          <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">{t("dashboard.weightTrend")}</h2>
          <WeightTrendChart weights={weights} />
        </section>
      </div>
    </main>
  );
}
