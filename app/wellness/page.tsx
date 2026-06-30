"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { isoToday, sleepQualityKey } from "@/lib/client/display";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { SleepLogView, WeightLogView } from "@/lib/types/domain";
import { WeightTrendChart } from "@/components/dashboard/WeightTrendChart";
import { SleepForm } from "@/components/health/SleepForm";
import { WeightForm } from "@/components/health/WeightForm";

type SleepValue = {
  hours: string;
  quality: SleepLogView["quality"];
  notes: string;
};

type WeightValue = {
  weightKg: string;
  notes: string;
};

export default function WellnessPage() {
  const { profileId, locale, t } = useApp();
  const [date, setDate] = useState(isoToday());
  const [sleep, setSleep] = useState<SleepLogView | null>(null);
  const [weight, setWeight] = useState<WeightLogView | null>(null);
  const [weights, setWeights] = useState<WeightLogView[]>([]);

  const load = useCallback(async () => {
    if (!profileId) return;
    const [sleepResponse, weightResponse, weightsResponse] = await Promise.all([
      apiFetch<{ sleep: SleepLogView | null }>(`/api/sleep?date=${date}`, { profileId, locale }),
      apiFetch<{ weight: WeightLogView | null }>(`/api/weight?date=${date}`, { profileId, locale }),
      apiFetch<{ weights: WeightLogView[] }>("/api/weight?recent=1", { profileId, locale })
    ]);
    setSleep(sleepResponse.sleep);
    setWeight(weightResponse.weight);
    setWeights(weightsResponse.weights);
  }, [date, locale, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSleep(value: SleepValue) {
    if (!profileId) return;
    await apiFetch<{ sleep: SleepLogView }>("/api/sleep", {
      method: "POST",
      profileId,
      locale,
      body: {
        profileId,
        date,
        hours: Number(value.hours),
        quality: value.quality,
        notes: value.notes
      }
    });
    await load();
  }

  async function deleteSleep() {
    if (!profileId) return;
    await apiFetch<{ deleted: boolean }>("/api/sleep", {
      method: "DELETE",
      profileId,
      locale,
      body: { profileId, date }
    });
    await load();
  }

  async function saveWeight(value: WeightValue) {
    if (!profileId) return;
    await apiFetch<{ weight: WeightLogView }>("/api/weight", {
      method: "POST",
      profileId,
      locale,
      body: {
        profileId,
        date,
        weightKg: Number(value.weightKg),
        notes: value.notes
      }
    });
    await load();
  }

  async function deleteWeight() {
    if (!profileId) return;
    await apiFetch<{ deleted: boolean }>("/api/weight", {
      method: "DELETE",
      profileId,
      locale,
      body: { profileId, date }
    });
    await load();
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <h1 className="page-title">{t("wellness.title")}</h1>
      </section>
      <label className="grid max-w-xs gap-1">
        <span className="field-label">{t("common.date")}</span>
        <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <div className="grid gap-4 xl:grid-cols-2">
        <SleepForm sleep={sleep} onSubmit={(value) => void saveSleep(value)} onDelete={() => void deleteSleep()} />
        <WeightForm weight={weight} onSubmit={(value) => void saveWeight(value)} onDelete={() => void deleteWeight()} />
      </div>
      <section className="panel">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("wellness.latest")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-sm text-slate-500">{t("wellness.sleepDuration")}</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{sleep ? `${sleep.hours} h · ${t(sleepQualityKey(sleep.quality))}` : "-"}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-sm text-slate-500">{t("wellness.weightKg")}</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{weight ? `${weight.weightKg} kg` : "-"}</p>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">{t("wellness.trend")}</h2>
        <WeightTrendChart weights={weights} />
      </section>
    </main>
  );
}
