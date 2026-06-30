import { NextRequest } from "next/server";
import { z } from "zod";
import { setRecipeFavorite } from "@/lib/repositories/recipeRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson } from "@/lib/server/http";
import { profileIdSchema } from "@/lib/validation/schemas";

const favoriteSchema = z.object({
  profileId: profileIdSchema,
  isFavorite: z.boolean()
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, favoriteSchema);
    const { id } = await context.params;
    const recipe = await setRecipeFavorite({
      profileId: body.profileId,
      recipeId: id,
      isFavorite: body.isFavorite
    });
    if (!recipe) {
      return jsonError("Recipe not found.", 404);
    }
    return jsonOk({ recipe });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
