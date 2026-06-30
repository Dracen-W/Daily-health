import { NextRequest } from "next/server";
import { getDailyHistory } from "@/lib/repositories/historyRepository";
import { handleRouteError, jsonError, jsonOk, localeFromRequest, profileIdFromRequest } from "@/lib/server/http";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ date: string }> }
) {
  const locale = localeFromRequest(request);
  try {
    const profileId = profileIdFromRequest(request);
    if (!profileId) {
      return jsonError("Missing profile ID.", 400);
    }
    const { date } = await context.params;
    const history = await getDailyHistory(profileId, date);
    return jsonOk({ history });
  } catch (error) {
    return handleRouteError(error, locale);
  }
}
