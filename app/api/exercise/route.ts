import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createExerciseLog,
  deleteExerciseLog,
  listExerciseLogs,
  updateExerciseLog
} from "@/lib/repositories/exerciseRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, parseJson, profileIdFromRequest } from "@/lib/server/http";
import { deleteByIdSchema, exerciseLogInputSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    const date = request.nextUrl.searchParams.get("date");
    if (!profileId || !date) {
      return jsonError("Missing profile ID or date.", 400);
    }
    const logs = await listExerciseLogs(profileId, date);
    const totalMinutes = logs.reduce((sum, log) => sum + log.durationMinutes, 0);
    return jsonOk({ logs, totalMinutes });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function POST(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, exerciseLogInputSchema);
    const log = await createExerciseLog(body);
    return jsonOk({ log }, 201);
  } catch (error) {
    return handleRouteError(error, locale);
  }
}

export async function PATCH(request: NextRequest) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, exerciseLogInputSchema.extend({ id: z.string().cuid() }));
    const log = await updateExerciseLog(body);
    if (!log) {
      return jsonError("Exercise log not found.", 404);
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
    const deleted = await deleteExerciseLog(body.profileId, body.id);
    return jsonOk({ deleted });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
