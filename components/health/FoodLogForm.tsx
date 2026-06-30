"use client";

import { useEffect, useState } from "react";
import type { FoodLogView, MealCategory } from "@/lib/types/domain";
import { useApp } from "@/lib/i18n/I18nProvider";

type FoodFormState = {
  id?: string;
  nameEn: string;
  nameZh: string;
  calories: string;
  notes: string;
  mealCategory: MealCategory;
};

const emptyState: FoodFormState = {
  nameEn: "",
  nameZh: "",
  calories: "",
  notes: "",
  mealCategory: "breakfast"
};

export function FoodLogForm({
  editing,
  onSubmit,
  onCancel
}: {
  editing: FoodLogView | null;
  onSubmit: (value: FoodFormState) => void;
  onCancel: () => void;
}) {
  const { t } = useApp();
  const [form, setForm] = useState<FoodFormState>(emptyState);

  useEffect(() => {
    setForm(
      editing
        ? {
            id: editing.id,
            nameEn: editing.nameEn,
            nameZh: editing.nameZh ?? "",
            calories: editing.calories?.toString() ?? "",
            notes: editing.notes ?? "",
            mealCategory: editing.mealCategory
          }
        : emptyState
    );
  }, [editing]);

  return (
    <form
      className="panel grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
        if (!editing) setForm(emptyState);
      }}
    >
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("food.addManual")}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1">
          <span className="field-label">{t("common.name")}</span>
          <input className="field-input" required value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("smart.displayNameZh")}</span>
          <input className="field-input" value={form.nameZh} onChange={(event) => setForm({ ...form, nameZh: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("food.meal")}</span>
          <select className="field-input" value={form.mealCategory} onChange={(event) => setForm({ ...form, mealCategory: event.target.value as MealCategory })}>
            <option value="breakfast">{t("food.breakfast")}</option>
            <option value="lunch">{t("food.lunch")}</option>
            <option value="dinner">{t("food.dinner")}</option>
            <option value="snack">{t("food.snack")}</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("common.calories")}</span>
          <input className="field-input" min="0" type="number" value={form.calories} onChange={(event) => setForm({ ...form, calories: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="field-label">{t("common.notes")}</span>
          <input className="field-input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" type="submit">
          {editing ? t("common.update") : t("common.add")}
        </button>
        {editing ? (
          <button className="btn-secondary" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
