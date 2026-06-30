import { NextRequest } from "next/server";
import { getIngredientScan, listEpicurePairings, saveEpicurePairings } from "@/lib/repositories/ingredientScanRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { getEpicurePairings } from "@/lib/services/epicureService";
import { generateRecipesRequestSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const scanId = request.nextUrl.searchParams.get("scanId");
    if (!scanId) {
      return jsonError("Missing scan ID.", 400);
    }
    const pairings = await listEpicurePairings(scanId);
    return jsonOk({ pairings });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function POST(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, generateRecipesRequestSchema);
    const profileId = profileIdFromRequest(request) ?? body.profileId;
    if (!body.scanId) {
      return jsonError("Missing scan ID.", 400);
    }
    const scan = await getIngredientScan(profileId, body.scanId);
    if (!scan) {
      return jsonError("Scan not found.", 404);
    }
    const result = await getEpicurePairings({
      ingredients: scan.ingredients,
      preferences: body.preferences
    });
    if (result.pairings.length > 0) {
      await saveEpicurePairings({ scanId: scan.id, pairings: result.pairings });
    }
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
