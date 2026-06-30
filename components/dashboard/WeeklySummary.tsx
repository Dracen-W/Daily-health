"use client";

export function WeeklySummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <section className="panel">
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
