"use client";

import type { ReactNode } from "react";

export function DashboardCard({
  title,
  value,
  detail,
  icon
}: {
  title: string;
  value: string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</h2>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-leaf dark:bg-emerald-950 dark:text-emerald-200">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p> : null}
    </article>
  );
}
