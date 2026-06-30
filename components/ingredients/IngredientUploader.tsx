"use client";

import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useApp } from "@/lib/i18n/I18nProvider";

type ImageDraft = {
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
};

type IngredientUploaderProps = {
  image: ImageDraft | null;
  onImage: (image: ImageDraft | null) => void;
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxSize = 8 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file: File): Promise<string> {
  const original = await fileToDataUrl(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = original;
  });

  const maxDimension = 1600;
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return original;
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

export function IngredientUploader({ image, onImage }: IngredientUploaderProps) {
  const { t } = useApp();
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    setError("");
    if (!file) {
      return;
    }
    if (!allowedTypes.has(file.type)) {
      setError(t("smart.fileTypeError"));
      return;
    }
    if (file.size > maxSize) {
      setError(t("smart.fileSizeError"));
      return;
    }
    const dataUrl = await resizeImage(file);
    onImage({
      fileName: file.name,
      mimeType: file.type as ImageDraft["mimeType"],
      dataUrl
    });
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" type="button" onClick={() => cameraRef.current?.click()}>
          <Camera className="h-4 w-4" aria-hidden="true" />
          {t("smart.takePhoto")}
        </button>
        <button className="btn-secondary" type="button" onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {t("smart.gallery")}
        </button>
        {image ? (
          <button className="btn-secondary" type="button" onClick={() => onImage(null)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("smart.removeImage")}
          </button>
        ) : null}
      </div>
      <input
        ref={cameraRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("smart.maxFile")}</p>
      {error ? <p className="text-sm font-medium text-berry">{error}</p> : null}
      {image ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
          <img src={image.dataUrl} alt={t("smart.preview")} className="max-h-[420px] w-full object-contain" />
        </div>
      ) : null}
    </section>
  );
}
