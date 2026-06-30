import { NextRequest } from "next/server";
import { z } from "zod";
import {
  deleteWeightLog,
  getLatestWeightLog,
  getWeightLog,
  listRecentWeightLogs,
  upsertWeightLog
} from "@/lib/repositories/weightRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { dateSchema, profileIdSchema, weightLogInputSchema } from "@/lib/validation/schemas";

const deleteWeightSchema = z.object({
  profileId: profileIdSchema,
  date: dateSchema
});

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    if (!profileId) {
      return jsonError("Missing profile ID.", 400);
    }
    if (request.nextUrl.searchParams.get("latest") === "1") {
      const weight = await getLatestWeightLog(profileId);
      return jsonOk({ weight });
    }
    if (request.nextUrl.searchParams.get("recent") === "1") {
      const weights = await listRecentWeightLogs(profileId);
      return jsonOk({ weights });
    }
    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return jsonError("Missing date.", 400);
    }
    const weight = await getWeightLog(profileId, date);
    return jsonOk({ weight });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function POST(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, weightLogInputSchema);
    const weight = await upsertWeightLog(body);
    return jsonOk({ weight });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function DELETE(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, deleteWeightSchema);
    const deleted = await deleteWeightLog(body.profileId, body.date);
    return jsonOk({ deleted });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
