import { NextRequest } from "next/server";
import { deleteRecipe, getRecipe } from "@/lib/repositories/recipeRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { deleteByIdSchema } from "@/lib/validation/schemas";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    if (!profileId) {
      return jsonError("Missing profile ID.", 400);
    }
    const { id } = await context.params;
    const recipe = await getRecipe(profileId, id);
    if (!recipe) {
      return jsonError("Recipe not found.", 404);
    }
    return jsonOk({ recipe });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const locale = localeFromRequest(request);
  try {
    const { id } = await context.params;
    const body = await parseJson(request, deleteByIdSchema);
    const deleted = await deleteRecipe(body.profileId, id);
    return jsonOk({ deleted });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
