import { NextRequest } from "next/server";
import { getLatestIngredientScan, listIngredientScans } from "@/lib/repositories/ingredientScanRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, profileIdFromRequest } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    if (!profileId) {
      return jsonError("Missing profile ID.", 400);
    }
    const latestOnly = request.nextUrl.searchParams.get("latest") === "1";
    if (latestOnly) {
      const scan = await getLatestIngredientScan(profileId);
      return jsonOk({ scan });
    }
    const scans = await listIngredientScans(profileId);
    return jsonOk({ scans });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
