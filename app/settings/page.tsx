"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/navigation/LanguageSwitcher";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";

export default function SettingsPage() {
  const { t, defaultWaterTargetMl, setDefaultWaterTargetMl } = useApp();
  const [target, setTarget] = useState(defaultWaterTargetMl.toString());

  return (
    <main className="page-shell">
      <section className="page-header">
        <h1 className="page-title">{t("settings.title")}</h1>
      </section>
      <section className="panel grid gap-5">
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("settings.language")}</h2>
          <LanguageSwitcher />
        </div>
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("settings.theme")}</h2>
          <ThemeToggle />
        </div>
        <div className="grid max-w-sm gap-2">
          <label className="grid gap-1">
            <span className="field-label">{t("settings.waterTarget")}</span>
            <input className="field-input" type="number" min="250" value={target} onChange={(event) => setTarget(event.target.value)} />
          </label>
          <button className="btn-primary justify-self-start" type="button" onClick={() => setDefaultWaterTargetMl(Number(target))}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {t("common.save")}
          </button>
        </div>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{t("settings.privacy")}</p>
      </section>
    </main>
  );
}
