import { NextRequest } from "next/server";
import { addWaterEntry, getWaterSummary, resetWaterEntries, setWaterTarget } from "@/lib/repositories/waterRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { waterEntrySchema, waterTargetSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    const date = request.nextUrl.searchParams.get("date");
    if (!profileId || !date) {
      return jsonError("Missing profile ID or date.", 400);
    }
    const water = await getWaterSummary(profileId, date);
    return jsonOk({ water });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function POST(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, waterEntrySchema);
    const water = await addWaterEntry(body.profileId, body.date, body.amountMl);
    return jsonOk({ water }, 201);
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function PATCH(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, waterTargetSchema);
    const water = await setWaterTarget(body.profileId, body.date, body.targetMl);
    return jsonOk({ water });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function DELETE(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, waterTargetSchema.pick({ profileId: true, date: true }));
    const water = await resetWaterEntries(body.profileId, body.date);
    return jsonOk({ water });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
