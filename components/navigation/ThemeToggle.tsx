"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { ThemeMode } from "@/lib/types/domain";

const options: Array<{ value: ThemeMode; icon: typeof Sun; key: "theme.light" | "theme.dark" | "theme.system" }> = [
  { value: "light", icon: Sun, key: "theme.light" },
  { value: "dark", icon: Moon, key: "theme.dark" },
  { value: "system", icon: Laptop, key: "theme.system" }
];

export function ThemeToggle() {
  const { theme, setTheme, t } = useApp();
  return (
    <div className="segmented" aria-label={t("settings.theme")}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            title={t(option.key)}
            className={`segmented-button flex items-center ${theme === option.value ? "segmented-button-active" : ""}`}
            onClick={() => setTheme(option.value)}
            aria-pressed={theme === option.value}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t(option.key)}</span>
          </button>
        );
      })}
    </div>
  );
}
