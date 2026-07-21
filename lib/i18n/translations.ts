import type { AppLocale } from "@/lib/types/domain";
import { en } from "./en";
import { zhCN } from "./zh-CN";

export type TranslationKey = keyof typeof en;

export const dictionaries: Record<AppLocale, Record<TranslationKey, string>> = {
  en,
  "zh-CN": zhCN
};

export function normalizeLocale(locale: string | null | undefined): AppLocale {
  return locale === "zh-CN" ? "zh-CN" : "en";
}

export function getDictionary(locale: AppLocale) {
  return dictionaries[locale];
}

export function translate(locale: AppLocale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? en[key] ?? key;
}
