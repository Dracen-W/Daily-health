import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createFoodLog,
  createRecipeFoodLog,
  deleteFoodLog,
  listFoodLogs,
  updateFoodLog
} from "@/lib/repositories/foodLogRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { dateSchema, deleteByIdSchema, foodLogInputSchema, mealCategorySchema, profileIdSchema } from "@/lib/validation/schemas";

const recipeLogSchema = z.object({
  profileId: profileIdSchema,
  recipeId: z.string().cuid(),
  date: dateSchema,
  mealCategory: mealCategorySchema,
  calories: z.number().int().min(0).max(5000).nullable().optional(),
  sourceType: z.literal("recipe")
});

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    const date = request.nextUrl.searchParams.get("date");
    if (!profileId || !date) {
      return jsonError("Missing profile ID or date.", 400);
    }
    const logs = await listFoodLogs(profileId, date);
    const total = logs.reduce((sum, log) => sum + (log.calories ?? 0), 0);
    return jsonOk({ logs, total });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function POST(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = (await request.json()) as unknown;
    const recipeParse = recipeLogSchema.safeParse(body);
    if (recipeParse.success) {
      const log = await createRecipeFoodLog(recipeParse.data);
      if (!log) {
        return jsonError("Recipe not found.", 404);
      }
      return jsonOk({ log }, 201);
    }
    const parsed = foodLogInputSchema.parse(body);
    const log = await createFoodLog({
      profileId: parsed.profileId,
      recipeId: parsed.recipeId,
      date: parsed.date,
      mealCategory: parsed.mealCategory,
      nameEn: parsed.nameEn,
      nameZh: parsed.nameZh,
      calories: parsed.calories,
      notes: parsed.notes,
      sourceType: parsed.sourceType
    });
    return jsonOk({ log }, 201);
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function PATCH(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, foodLogInputSchema.extend({ id: z.string().cuid() }));
    const log = await updateFoodLog({
      id: body.id,
      profileId: body.profileId,
      date: body.date,
      mealCategory: body.mealCategory,
      nameEn: body.nameEn,
      nameZh: body.nameZh,
      calories: body.calories,
      notes: body.notes
    });
    if (!log) {
      return jsonError("Food log not found.", 404);
    }
    return jsonOk({ log });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function DELETE(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, deleteByIdSchema);
    const deleted = await deleteFoodLog(body.profileId, body.id);
    return jsonOk({ deleted });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
