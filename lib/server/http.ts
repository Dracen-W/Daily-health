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

function isDatabaseConfigurationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("schema.prisma") &&
    (
      message.includes("database_url") ||
      message.includes("datasource") ||
      message.includes("environment variable not found") ||
      message.includes("url must start")
    )
  );
}

export function handleRouteError(error: unknown, locale: AppLocale) {
  if (error instanceof ZodError) {
    return jsonError(error.issues.map((issue) => issue.message).join(", "), 400);
  }

  if (isDatabaseConfigurationError(error)) {
    console.error(error);
    return jsonError(
      "Database is not configured correctly. For this SQLite app, set DATABASE_URL to file:./daily-health.db and regenerate Prisma Client.",
      503
    );
  }

  console.error(error);
  return jsonMessageError(locale, "common.error", 500);
}
