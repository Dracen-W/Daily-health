import type { EpicurePairingInput, RecognizedIngredientInput, RecipePreferenceInput } from "@/lib/types/domain";

type EpicureStatus = "connected" | "missing" | "failed";

type EpicureResult = {
  status: EpicureStatus;
  pairings: EpicurePairingInput[];
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function dietaryConflict(name: string, preference: string) {
  const lower = `${name} ${preference}`.toLowerCase();
  if (preference === "No Beef") return lower.includes("beef");
  if (preference === "No Pork") return lower.includes("pork") || lower.includes("bacon");
  if (preference === "No Seafood") return lower.includes("shrimp") || lower.includes("fish") || lower.includes("seafood");
  if (preference === "Vegetarian") {
    return ["chicken", "beef", "pork", "fish", "shrimp", "seafood", "meat"].some((word) => lower.includes(word));
  }
  return false;
}

function collectPairingObjects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectPairingObjects);
  }
  if (!isObject(value)) {
    return [];
  }
  const likelyName =
    value.suggestedIngredient ??
    value.ingredient ??
    value.name ??
    value.target ??
    value.neighbor;
  if (asString(likelyName)) {
    return [value];
  }
  return Object.values(value).flatMap(collectPairingObjects);
}

async function callMcpTool(baseUrl: string, toolName: string, ingredient: string): Promise<unknown> {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: {
          ingredient,
          limit: 5
        }
      }
    }),
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`Epicure MCP returned ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

export async function getEpicurePairings(input: {
  ingredients: RecognizedIngredientInput[];
  preferences: RecipePreferenceInput;
}): Promise<EpicureResult> {
  const baseUrl = process.env.EPICURE_MCP_URL?.trim();
  if (!baseUrl) {
    return { status: "missing", pairings: [] };
  }

  try {
    const pairings: EpicurePairingInput[] = [];
    const seen = new Set<string>();
    const mainIngredients = input.ingredients.slice(0, 5);

    for (const ingredient of mainIngredients) {
      let raw: unknown = null;
      for (const tool of ["find_pairings", "neighbors", "pairing_score"]) {
        try {
          raw = await callMcpTool(baseUrl, tool, ingredient.normalizedName);
          if (raw) break;
        } catch (error) {
          console.warn(`Epicure tool ${tool} failed`, error);
        }
      }

      for (const item of collectPairingObjects(raw).slice(0, 5)) {
        const suggested =
          asString(item.suggestedIngredient) ??
          asString(item.ingredient) ??
          asString(item.name) ??
          asString(item.target) ??
          asString(item.neighbor);
        if (!suggested || dietaryConflict(suggested, input.preferences.dietaryPreference)) {
          continue;
        }

        const key = `${ingredient.normalizedName}:${suggested.toLowerCase()}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        pairings.push({
          sourceIngredient: ingredient.normalizedName,
          suggestedIngredient: suggested,
          score: asNumber(item.score),
          category: asString(item.category),
          reasonEn:
            asString(item.reasonEn) ??
            asString(item.reason) ??
            `${suggested} may pair well with ${ingredient.displayNameEn}.`,
          reasonZh:
            asString(item.reasonZh) ??
            `${suggested} 可以作为 ${ingredient.displayNameZh} 的风味搭配参考。`
        });
      }
    }

    return { status: "connected", pairings: pairings.slice(0, 20) };
  } catch (error) {
    console.error("Epicure MCP failed", error);
    return { status: "failed", pairings: [] };
  }
}
