"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { useApp } from "@/lib/i18n/I18nProvider";
import type { IngredientScanView, RecognizedIngredientInput } from "@/lib/types/domain";
import { IngredientEditor } from "@/components/ingredients/IngredientEditor";
import { IngredientRecognitionResult } from "@/components/ingredients/IngredientRecognitionResult";
import { IngredientUploader } from "@/components/ingredients/IngredientUploader";
import { Toast, type ToastState } from "@/components/shared/Toast";

type ImageDraft = {
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
};

export default function SmartScanPage() {
  const { profileId, locale, t } = useApp();
  const router = useRouter();
  const [image, setImage] = useState<ImageDraft | null>(null);
  const [scan, setScan] = useState<IngredientScanView | null>(null);
  const [ingredients, setIngredients] = useState<RecognizedIngredientInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  function showToast(message: string, type: "success" | "error" | "info" = "info") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function analyze() {
    if (!profileId || !image) return;
    setLoading(true);
    try {
      const response = await apiFetch<{ scan: IngredientScanView }>("/api/analyze-ingredients", {
        method: "POST",
        profileId,
        locale,
        body: {
          profileId,
          locale,
          imageName: image.fileName,
          imageMimeType: image.mimeType,
          imageDataUrl: image.dataUrl
        }
      });
      setScan(response.scan);
      setIngredients(response.scan.ingredients);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function generateRecipes() {
    if (!profileId || !scan) return;
    try {
      await apiFetch<{ scan: IngredientScanView }>(`/api/ingredient-scans/${scan.id}`, {
        method: "PATCH",
        profileId,
        locale,
        body: { profileId, ingredients }
      });
      router.push(`/recipes?scanId=${scan.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    }
  }

  return (
    <main className="page-shell">
      <Toast toast={toast} />
      <section className="page-header">
        <h1 className="page-title">{t("smart.title")}</h1>
        <p className="page-subtitle">{t("smart.subtitle")}</p>
      </section>
      <IngredientUploader image={image} onImage={setImage} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" type="button" disabled={!image || loading} onClick={() => void analyze()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {scan ? t("smart.again") : t("smart.start")}
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            setImage(null);
            setScan(null);
            setIngredients([]);
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t("smart.again")}
        </button>
      </div>
      <p className="rounded-md bg-white/80 p-3 text-sm leading-6 text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">{t("smart.notice")}</p>
      {scan ? <IngredientRecognitionResult scan={{ ...scan, ingredients: ingredients.map((ingredient, index) => ({ ...ingredient, id: scan.ingredients[index]?.id ?? `${index}`, position: index })) }} /> : null}
      {scan ? (
        <>
          <IngredientEditor ingredients={ingredients} onChange={setIngredients} />
          <button className="btn-primary self-start" type="button" onClick={() => void generateRecipes()}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("smart.generate")}
          </button>
        </>
      ) : null}
    </main>
  );
}
