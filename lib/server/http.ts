import { NextRequest, NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { normalizeLocale, translate, type TranslationKey } from "@/lib/i18n/translations";
import type { AppLocale } from "@/lib/types/domain";

export function localeFromRequest(request: NextRequest): AppLocale {
  return normalizeLocale(
    request.headers.get("x-app-locale") ??
      request.cookies.get("daily_health_locale")?.value ??
      request.nextUrl.searchParams.get("locale")
  );
}

export function profileIdFromRequest(request: NextRequest): string | null {
  return request.headers.get("x-profile-id") ?? request.nextUrl.searchParams.get("profileId");
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonMessageError(locale: AppLocale, key: TranslationKey, status: number) {
  return NextResponse.json({ error: translate(locale, key) }, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJson<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<z.infer<S>> {
  const body = (await request.json()) as unknown;
  return schema.parse(body);
}

export function handleRouteError(error: unknown, locale: AppLocale) {
  if (error instanceof ZodError) {
    return jsonError(error.issues.map((issue) => issue.message).join(", "), 400);
  }

  console.error(error);
  return jsonMessageError(locale, "common.error", 500);
}
