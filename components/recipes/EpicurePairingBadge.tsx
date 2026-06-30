"use client";

import { Network, Sparkles } from "lucide-react";
import { useApp } from "@/lib/i18n/I18nProvider";

export function EpicurePairingBadge({ status }: { status: "connected" | "missing" | "failed" | null }) {
  const { t } = useApp();
  if (!status) {
    return null;
  }
  const message =
    status === "missing"
      ? t("recipes.epicureMissing")
      : status === "failed"
        ? t("recipes.epicureFailed")
        : "Epicure / FlavorGraph";
  const Icon = status === "connected" ? Sparkles : Network;
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <Icon className="mt-0.5 h-4 w-4 text-leaf" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
