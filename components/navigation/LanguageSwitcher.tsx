"use client";

import { Languages } from "lucide-react";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { AppLocale } from "@/lib/types/domain";

const options: Array<{ label: string; value: AppLocale }> = [
  { label: "EN", value: "en" },
  { label: "中文", value: "zh-CN" }
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useApp();
  return (
    <div className="flex items-center gap-2" aria-label={t("settings.language")}>
      <Languages className="h-4 w-4 text-slate-500 dark:text-slate-300" aria-hidden="true" />
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`segmented-button ${locale === option.value ? "segmented-button-active" : ""}`}
            onClick={() => setLocale(option.value)}
            aria-pressed={locale === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
