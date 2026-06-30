import { NextRequest } from "next/server";
import { deleteDailyHealthRecords } from "@/lib/repositories/historyRepository";
import { handleRouteError, jsonOk, localeFromRequest, parseJson } from "@/lib/server/http";
import { profileRequestSchema } from "@/lib/validation/schemas";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ date: string }> }
) {
  const locale = localeFromRequest(request);
  try {
    const body = await parseJson(request, profileRequestSchema);
    const { date } = await context.params;
    await deleteDailyHealthRecords(body.profileId, date);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
