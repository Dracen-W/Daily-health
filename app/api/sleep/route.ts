import { NextRequest } from "next/server";
import { z } from "zod";
import { deleteSleepLog, getLatestSleepLog, getSleepLog, upsertSleepLog } from "@/lib/repositories/sleepRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { dateSchema, profileIdSchema, sleepLogInputSchema } from "@/lib/validation/schemas";

const deleteSleepSchema = z.object({
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
      const sleep = await getLatestSleepLog(profileId);
      return jsonOk({ sleep });
    }
    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return jsonError("Missing date.", 400);
    }
    const sleep = await getSleepLog(profileId, date);
    return jsonOk({ sleep });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function POST(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, sleepLogInputSchema);
    const sleep = await upsertSleepLog(body);
    return jsonOk({ sleep });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function DELETE(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, deleteSleepSchema);
    const deleted = await deleteSleepLog(body.profileId, body.date);
    return jsonOk({ deleted });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
