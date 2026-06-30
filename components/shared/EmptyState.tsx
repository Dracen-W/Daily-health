"use client";

import { Inbox } from "lucide-react";
import { useApp } from "@/lib/i18n/I18nProvider";

export function EmptyState({ message }: { message?: string }) {
  const { t } = useApp();
  return (
    <div className="flex min-h-28 items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
      <Inbox className="h-5 w-5" aria-hidden="true" />
      <span>{message ?? t("common.empty")}</span>
    </div>
  );
}
