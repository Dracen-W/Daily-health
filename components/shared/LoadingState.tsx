"use client";

import { Loader2 } from "lucide-react";
import { useApp } from "@/lib/i18n/I18nProvider";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useApp();
  return (
    <div className="flex min-h-28 items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}
