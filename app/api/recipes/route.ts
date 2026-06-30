import { NextRequest } from "next/server";
import { listRecipes } from "@/lib/repositories/recipeRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, profileIdFromRequest } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    if (!profileId) {
      return jsonError("Missing profile ID.", 400);
    }
    const favoritesOnly = request.nextUrl.searchParams.get("favorites") === "1";
    const recipes = await listRecipes(profileId, favoritesOnly);
    return jsonOk({ recipes });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
