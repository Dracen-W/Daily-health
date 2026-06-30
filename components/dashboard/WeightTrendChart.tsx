"use client";

import type { WeightLogView } from "@/lib/types/domain";

export function WeightTrendChart({ weights }: { weights: WeightLogView[] }) {
  const values = weights.map((weight) => weight.weightKg);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const spread = Math.max(max - min, 1);

  return (
    <div className="flex h-40 items-end gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-950">
      {weights.length === 0 ? (
        <div className="m-auto text-sm text-slate-500">-</div>
      ) : (
        weights.map((weight) => {
          const height = 20 + ((weight.weightKg - min) / spread) * 100;
          return (
            <div key={weight.id} className="flex min-w-8 flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t bg-leaf" style={{ height: `${height}px` }} />
              <span className="text-xs text-slate-500">{weight.date.slice(5)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
