import { NextRequest } from "next/server";
import { ensureProfile } from "@/lib/repositories/profileRepository";
import { handleRouteError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { profileRequestSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    if (!profileId) {
      return jsonOk({ profile: null, settings: null }, 200);
    }
    const result = await ensureProfile(profileId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function POST(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, profileRequestSchema);
    const result = await ensureProfile(body.profileId);
    return jsonOk(result, 201);
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
