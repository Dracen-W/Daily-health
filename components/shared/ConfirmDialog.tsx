"use client";

import { AlertTriangle } from "lucide-react";
import { useApp } from "@/lib/i18n/I18nProvider";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, message, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useApp();
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-5 shadow-soft dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className={danger ? "h-6 w-6 text-berry" : "h-6 w-6 text-citrus"} aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button className={danger ? "btn-danger" : "btn-primary"} type="button" onClick={onConfirm}>
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
