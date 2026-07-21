import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { generateFallbackRecipes } from "../../../../lib/services/fallbackRecipeService";
import { buildNutritionSummary } from "../../../../lib/services/nutritionStructure";
import { calculateDailyCalorieTarget } from "../../../../lib/services/calorieTargets";
import type {
  DailyHistoryView,
  ExerciseLogView,
  FoodLogView,
  IngredientScanView,
  RecognizedIngredientInput,
  RecipeView,
  SleepLogView,
  UserProfileView,
  WaterSummary,
  WeightLogView
} from "../domain";
import {
  type AiProvider,
  type AiSettings,
  type AiSettingsInput,
  type DataAdapter,
  DataAdapterError,
  type IngredientScanInput,
  type ProfileInput,
  type Settings,
} from "./DataAdapter";

type StoredRecord<T> = {
  id: string;
  data: T;
  createdAt: string;
  updatedAt: string;
};

type LocalSettings = Settings & { aiProvider: AiProvider };

const databaseName = "daily-health.db";
const keyName = (provider: AiProvider, profileId: string) => `daily-health.ai.${provider}.${profileId}`;
let localIdSequence = 0;

function now() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  localIdSequence = (localIdSequence + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}_${localIdSequence.toString(36)}`;
}

function parseRecord<T>(row: { record_id: string; data_json: string; created_at: string; updated_at: string } | null): StoredRecord<T> | null {
  if (!row) return null;
  try {
    return {
      id: row.record_id,
      data: JSON.parse(row.data_json) as T,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch {
    return null;
  }
}

function defaultProfile(profileId: string): UserProfileView {
  const createdAt = now();
  return {
    id: profileId,
    displayName: null,
    gender: null,
    birthYear: null,
    heightCm: null,
    weightKg: null,
    activityLevel: "sedentary",
    calorieGoal: "maintain",
    dailyCalorieTarget: null,
    createdAt,
    updatedAt: createdAt
  };
}

function defaultSettings(): LocalSettings {
  return { locale: "en", theme: "light", defaultWaterTargetMl: 2000, aiProvider: "gemini" };
}

function isAiProvider(value: unknown): value is AiProvider {
  return value === "gemini" || value === "openai";
}

function cleanDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new DataAdapterError("The selected image could not be read.", 400, "INVALID_IMAGE");
  const mimeType = match[1];
  const base64 = match[2];
  if (!mimeType || !base64) throw new DataAdapterError("The selected image could not be read.", 400, "INVALID_IMAGE");
  return { mimeType, base64: base64.replace(/\s/g, "") };
}

function parseAiJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

function asIngredient(value: unknown): RecognizedIngredientInput | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const text = (key: string) => typeof item[key] === "string" ? item[key].trim() : "";
  const confidence = item.confidence === "high" || item.confidence === "low" ? item.confidence : "medium";
  const calories = typeof item.estimatedCalories === "number" && Number.isFinite(item.estimatedCalories)
    ? Math.max(0, Math.round(item.estimatedCalories))
    : undefined;
  const normalizedName = text("normalizedName");
  const displayNameEn = text("displayNameEn");
  const displayNameZh = text("displayNameZh");
  if (!normalizedName || !displayNameEn || !displayNameZh) return null;
  return {
    normalizedName,
    displayNameEn,
    displayNameZh,
    estimatedAmount: text("estimatedAmount") || "as available",
    estimatedCalories: calories,
    confidence,
    notes: text("notes")
  };
}

/** Local free-tier data path: no embedded service or WebView bridge. */
export class LocalAdapter implements DataAdapter {
  readonly mode = "local" as const;
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

  constructor(private readonly profileId: string) {}

  private async database() {
    this.databasePromise ??= (async () => {
      const db = await SQLite.openDatabaseAsync(databaseName);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS health_records (
          record_type TEXT NOT NULL,
          record_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          record_date TEXT,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (record_type, record_id)
        );
        CREATE INDEX IF NOT EXISTS health_records_profile_type_date
          ON health_records (profile_id, record_type, record_date);
        CREATE INDEX IF NOT EXISTS health_records_profile_type_updated
          ON health_records (profile_id, record_type, updated_at);
        CREATE TABLE IF NOT EXISTS error_logs (
          id TEXT PRIMARY KEY,
          profile_id TEXT,
          source TEXT NOT NULL,
          severity TEXT NOT NULL,
          message TEXT NOT NULL,
          data_json TEXT,
          created_at TEXT NOT NULL
        );
      `);
      return db;
    })();
    return this.databasePromise;
  }

  private async getRecord<T>(type: string, id: string) {
    const db = await this.database();
    const row = await db.getFirstAsync<{ record_id: string; data_json: string; created_at: string; updated_at: string }>(
      "SELECT record_id, data_json, created_at, updated_at FROM health_records WHERE record_type = ? AND profile_id = ? AND record_id = ? LIMIT 1",
      [type, this.profileId, id]
    );
    return parseRecord<T>(row ?? null);
  }

  private async listRecords<T>(type: string) {
    const db = await this.database();
    const rows = await db.getAllAsync<{ record_id: string; data_json: string; created_at: string; updated_at: string }>(
      "SELECT record_id, data_json, created_at, updated_at FROM health_records WHERE record_type = ? AND profile_id = ? ORDER BY created_at DESC",
      [type, this.profileId]
    );
    return rows.flatMap((row) => {
      const parsed = parseRecord<T>(row);
      return parsed ? [parsed] : [];
    });
  }

  private async listRecordsForDate<T>(type: string, date: string) {
    const db = await this.database();
    const rows = await db.getAllAsync<{ record_id: string; data_json: string; created_at: string; updated_at: string }>(
      "SELECT record_id, data_json, created_at, updated_at FROM health_records WHERE record_type = ? AND profile_id = ? AND record_date = ? ORDER BY created_at ASC",
      [type, this.profileId, date]
    );
    return rows.flatMap((row) => {
      const parsed = parseRecord<T>(row);
      return parsed ? [parsed] : [];
    });
  }

  private async deleteRecord(type: string, id: string) {
    const db = await this.database();
    const result = await db.runAsync(
      "DELETE FROM health_records WHERE record_type = ? AND profile_id = ? AND record_id = ?",
      [type, this.profileId, id]
    );
    return result.changes > 0;
  }

  private async deleteRecordsForDate(type: string, date: string) {
    const db = await this.database();
    await db.runAsync(
      "DELETE FROM health_records WHERE record_type = ? AND profile_id = ? AND record_date = ?",
      [type, this.profileId, date]
    );
  }

  private async saveRecord<T>(type: string, id: string, data: T, recordDate: string | null = null, createdAt = now()) {
    const db = await this.database();
    const updatedAt = now();
    await db.runAsync(
      `INSERT INTO health_records (record_type, record_id, profile_id, record_date, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(record_type, record_id) DO UPDATE SET
         profile_id = excluded.profile_id,
         record_date = excluded.record_date,
         data_json = excluded.data_json,
         updated_at = excluded.updated_at`,
      [type, id, this.profileId, recordDate, JSON.stringify(data), createdAt, updatedAt]
    );
    return { id, data, createdAt, updatedAt } satisfies StoredRecord<T>;
  }

  async ensureProfile() {
    let profileRecord = await this.getRecord<UserProfileView>("profile", this.profileId);
    if (!profileRecord) profileRecord = await this.saveRecord("profile", this.profileId, defaultProfile(this.profileId));
    let settingsRecord = await this.getRecord<LocalSettings>("settings", this.profileId);
    if (!settingsRecord) settingsRecord = await this.saveRecord("settings", this.profileId, defaultSettings());
    return { profile: profileRecord.data, settings: settingsRecord.data };
  }

  async getProfile() {
    return (await this.ensureProfile()).profile;
  }

  async saveProfile(input: ProfileInput) {
    const profile = await this.getProfile();
    const updated: UserProfileView = {
      ...profile,
      ...input,
      displayName: input.displayName === undefined ? profile.displayName : input.displayName?.trim() || null,
      updatedAt: now()
    };
    await this.saveRecord("profile", this.profileId, updated, null, profile.createdAt);
    return updated;
  }

  async getSettings(): Promise<Settings> {
    const { settings } = await this.ensureProfile();
    return settings;
  }

  async saveSettings(input: Partial<Settings>): Promise<Settings> {
    const { settings } = await this.ensureProfile();
    const updated: LocalSettings = {
      ...settings,
      ...input,
      locale: input.locale === "zh-CN" ? "zh-CN" : input.locale === "en" ? "en" : settings.locale,
      theme: input.theme === "dark" || input.theme === "system" || input.theme === "light" ? input.theme : settings.theme,
      defaultWaterTargetMl: Number.isFinite(input.defaultWaterTargetMl) ? Math.max(250, Math.round(input.defaultWaterTargetMl!)) : settings.defaultWaterTargetMl
    };
    await this.saveRecord("settings", this.profileId, updated);
    return updated;
  }

  private async keys() {
    return Promise.all([
      SecureStore.getItemAsync(keyName("gemini", this.profileId)),
      SecureStore.getItemAsync(keyName("openai", this.profileId))
    ]);
  }

  async getAiSettings(): Promise<AiSettings> {
    const [{ settings }, [geminiKey, openaiKey]] = await Promise.all([this.ensureProfile(), this.keys()]);
    const provider = isAiProvider(settings.aiProvider) ? settings.aiProvider : "gemini";
    const geminiConfigured = Boolean(geminiKey);
    const openaiConfigured = Boolean(openaiKey);
    return {
      provider,
      model: provider === "gemini" ? "gemini-3.1-flash-lite" : "gpt-4o-mini",
      configured: provider === "gemini" ? geminiConfigured : openaiConfigured,
      profileKeyConfigured: provider === "gemini" ? geminiConfigured : openaiConfigured,
      environmentKeyConfigured: false,
      providers: {
        gemini: { configured: geminiConfigured, profileKeyConfigured: geminiConfigured },
        openai: { configured: openaiConfigured, profileKeyConfigured: openaiConfigured }
      }
    };
  }

  async saveAiSettings(input: AiSettingsInput): Promise<AiSettings> {
    if (input.apiKey && input.apiKey.trim().length < 20) throw new DataAdapterError("Enter a valid API key.", 400, "INVALID_API_KEY");
    const { settings } = await this.ensureProfile();
    if (input.clearApiKey) {
      await SecureStore.deleteItemAsync(keyName(input.provider, this.profileId));
    } else if (input.apiKey?.trim()) {
      await SecureStore.setItemAsync(keyName(input.provider, this.profileId), input.apiKey.trim());
    }
    await this.saveRecord("settings", this.profileId, { ...settings, aiProvider: input.provider });
    return this.getAiSettings();
  }

  async getServiceStatus(): Promise<import("./DataAdapter").ServiceStatusResponse> {
    const ai = await this.getAiSettings();
    const items: import("./DataAdapter").ServiceStatusItem[] = [
      { id: "app", state: "ok", titleEn: "Local App", titleZh: "本地应用", summaryEn: "React Native", summaryZh: "React Native", detailsEn: ["Running locally"], detailsZh: ["本地运行"] },
      { id: "database", state: "ok", titleEn: "SQLite", titleZh: "SQLite", summaryEn: "expo-sqlite", summaryZh: "expo-sqlite", detailsEn: [databaseName], detailsZh: [databaseName] },
      { id: "ai", state: ai.configured ? "ok" : "warning", titleEn: "AI Recognition", titleZh: "AI 识别", summaryEn: ai.provider, summaryZh: ai.provider, detailsEn: [ai.configured ? "Key configured" : "Key missing"], detailsZh: [ai.configured ? "密钥已配置" : "密钥未配置"] },
      { id: "epicure", state: "ok", titleEn: "Epicure Flavor", titleZh: "Epicure 风味", summaryEn: "MCP service", summaryZh: "MCP 服务", detailsEn: ["Connected"], detailsZh: ["已连接"] }
    ];
    return { overall: items.every(i => i.state === "ok") ? "ok" : "warning", checkedAt: now(), items };
  }

  async getErrorLogs(limit = 10): Promise<import("../domain").AppErrorLogView[]> {
    const db = await this.database();
    const rows = await db.getAllAsync<{ id: string; source: string; severity: any; message: string; data_json: string; created_at: string }>(
      "SELECT id, source, severity, message, data_json, created_at FROM error_logs WHERE profile_id = ? OR profile_id IS NULL ORDER BY created_at DESC LIMIT ?",
      [this.profileId, limit]
    );
    return rows.map(row => ({
      id: row.id,
      profileId: this.profileId,
      source: row.source,
      severity: row.severity,
      message: row.message,
      path: null,
      method: null,
      statusCode: null,
      stack: null,
      userAgent: "Native",
      details: row.data_json ? JSON.parse(row.data_json) : null,
      createdAt: row.created_at
    }));
  }

  async logError(input: { source: string; severity: string; message: string; data?: any }): Promise<void> {
    const db = await this.database();
    await db.runAsync(
      "INSERT INTO error_logs (id, profile_id, source, severity, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newId("err"), this.profileId, input.source, input.severity, input.message, JSON.stringify(input.data ?? {}), now()]
    );
  }

  async analyzeIngredients(input: IngredientScanInput): Promise<IngredientScanView> {
    const aiSettings = await this.getAiSettings();
    const image = cleanDataUrl(input.image.dataUrl);
    const prompt = [
      "Analyze visible food, ingredients, beverages, and obvious seasonings only.",
      "Do not invent hidden ingredients. Return English and Simplified Chinese names.",
      "Return JSON only: { overallConfidence, uncertaintyNoteEn, uncertaintyNoteZh, ingredients }.",
      "Each ingredient needs normalizedName, displayNameEn, displayNameZh, estimatedAmount, estimatedCalories, confidence, notes."
    ].join(" ");
    const apiKey = await SecureStore.getItemAsync(keyName(aiSettings.provider, this.profileId));
    if (!apiKey) throw new DataAdapterError(`Add your ${aiSettings.provider === "gemini" ? "Gemini" : "OpenAI"} API key in Profile before scanning.`, 400, "LOCAL_AI_KEY_REQUIRED");
    let output = "";
    if (aiSettings.provider === "gemini") {
      let response: Response;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }] }]
          })
        });
        clearTimeout(timeout);
      } catch (err: any) {
        if (err.name === "AbortError") throw new DataAdapterError("Gemini request timed out.", 408, "AI_TIMEOUT");
        throw new DataAdapterError("Unable to reach Gemini. Check your connection and API key.", null, "AI_NETWORK_ERROR");
      }
      if (!response.ok) throw new DataAdapterError("Gemini could not analyze this image. Check the API key and try again.", response.status, "AI_REQUEST_FAILED");
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    } else {
      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: input.image.dataUrl, detail: "low" } }
              ]
            }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "ingredient_scan",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["overallConfidence", "uncertaintyNoteEn", "uncertaintyNoteZh", "ingredients"],
                  properties: {
                    overallConfidence: { type: "string", enum: ["high", "medium", "low"] },
                    uncertaintyNoteEn: { type: "string" },
                    uncertaintyNoteZh: { type: "string" },
                    ingredients: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["normalizedName", "displayNameEn", "displayNameZh", "estimatedAmount", "estimatedCalories", "confidence", "notes"],
                        properties: {
                          normalizedName: { type: "string" }, displayNameEn: { type: "string" }, displayNameZh: { type: "string" }, estimatedAmount: { type: "string" }, estimatedCalories: { type: "number" }, confidence: { type: "string", enum: ["high", "medium", "low"] }, notes: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          })
        });
      } catch {
        throw new DataAdapterError("Unable to reach OpenAI. Check your connection and API key.", null, "AI_NETWORK_ERROR");
      }
      if (!response.ok) throw new DataAdapterError("OpenAI could not analyze this image. Check the API key and try again.", response.status, "AI_REQUEST_FAILED");
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
      output = payload.choices?.[0]?.message?.content ?? "";
    }
    let result: { overallConfidence?: unknown; uncertaintyNoteEn?: unknown; uncertaintyNoteZh?: unknown; ingredients?: unknown };
    try {
      result = parseAiJson(output) as typeof result;
    } catch {
      throw new DataAdapterError("Gemini returned an unexpected recognition result.", 502, "AI_INVALID_RESPONSE");
    }
    const ingredients = Array.isArray(result.ingredients) ? result.ingredients.flatMap((item) => {
      const ingredient = asIngredient(item);
      return ingredient ? [ingredient] : [];
    }) : [];
    const createdAt = now();
    const scan: IngredientScanView = {
      id: newId("scan"),
      imageName: input.image.fileName,
      imageMimeType: input.image.mimeType,
      overallConfidence: result.overallConfidence === "high" || result.overallConfidence === "low" ? result.overallConfidence : "medium",
      uncertaintyNoteEn: typeof result.uncertaintyNoteEn === "string" ? result.uncertaintyNoteEn : "Confirm the ingredient list before using it.",
      uncertaintyNoteZh: typeof result.uncertaintyNoteZh === "string" ? result.uncertaintyNoteZh : "使用前请确认食材清单。",
      confirmedAt: null,
      createdAt,
      ingredients: ingredients.map((ingredient, position) => ({ ...ingredient, id: newId("ingredient"), position }))
    };
    await this.saveRecord("ingredient-scan", scan.id, scan, createdAt.slice(0, 10), createdAt);
    return scan;
  }

  async getIngredientScans() {
    return (await this.listRecords<IngredientScanView>("ingredient-scan")).map((record) => record.data);
  }

  async getIngredientScan(scanId: string) {
    return (await this.getRecord<IngredientScanView>("ingredient-scan", scanId))?.data ?? null;
  }

  async saveIngredientScan(scanId: string, input: { ingredients: RecognizedIngredientInput[]; confirmed?: boolean }) {
    const record = await this.getRecord<IngredientScanView>("ingredient-scan", scanId);
    if (!record) throw new DataAdapterError("Ingredient scan not found.", 404, "SCAN_NOT_FOUND");
    const updated: IngredientScanView = {
      ...record.data,
      confirmedAt: input.confirmed ? now() : null,
      ingredients: input.ingredients.map((ingredient, position) => ({
        ...ingredient,
        id: record.data.ingredients[position]?.id ?? newId("ingredient"),
        position
      }))
    };
    await this.saveRecord("ingredient-scan", scanId, updated, updated.createdAt.slice(0, 10), record.createdAt);
    return updated;
  }

  /** Internal mirror hook. It preserves cloud IDs and timestamps in SQLite. */
  async upsertIngredientScan(scan: IngredientScanView) {
    const existing = await this.getRecord<IngredientScanView>("ingredient-scan", scan.id);
    await this.saveRecord(
      "ingredient-scan",
      scan.id,
      scan,
      scan.createdAt.slice(0, 10),
      existing?.createdAt ?? scan.createdAt
    );
    return scan;
  }

  async upsertRecipe(recipe: RecipeView) {
    const existing = await this.getRecord<RecipeView>("recipe", recipe.id);
    await this.saveRecord("recipe", recipe.id, recipe, recipe.createdAt.slice(0, 10), existing?.createdAt ?? recipe.createdAt);
    return recipe;
  }

  async replaceWaterSummary(water: WaterSummary) {
    await this.deleteRecordsForDate("water-entry", water.date);
    await Promise.all(water.entries.map((entry) => this.saveRecord("water-entry", entry.id, entry, water.date, entry.createdAt)));
    await this.saveRecord("water-target", water.date, { targetMl: water.targetMl }, water.date);
    return water;
  }

  async upsertFoodLog(log: FoodLogView) {
    const existing = await this.getRecord<FoodLogView>("food-log", log.id);
    await this.saveRecord("food-log", log.id, log, log.date, existing?.createdAt ?? log.createdAt);
    return log;
  }

  async upsertExercise(log: ExerciseLogView) {
    const existing = await this.getRecord<ExerciseLogView>("exercise", log.id);
    await this.saveRecord("exercise", log.id, log, log.date, existing?.createdAt ?? log.createdAt);
    return log;
  }

  async upsertSleep(log: SleepLogView | null) {
    if (!log) return null;
    const existing = await this.getRecord<SleepLogView>("sleep", log.date);
    await this.saveRecord("sleep", log.date, log, log.date, existing?.createdAt ?? log.createdAt);
    return log;
  }

  async upsertWeight(log: WeightLogView | null) {
    if (!log) return null;
    const existing = await this.getRecord<WeightLogView>("weight", log.date);
    await this.saveRecord("weight", log.date, log, log.date, existing?.createdAt ?? log.createdAt);
    return log;
  }

  async getRecipes(options?: { favorites?: boolean }) {
    const recipes = (await this.listRecords<RecipeView>("recipe")).map((record) => record.data);
    if (options?.favorites) return recipes.filter((r) => r.isFavorite);
    return recipes;
  }

  async saveRecipe(recipeId: string, input: Partial<RecipeView>) {
    const record = await this.getRecord<RecipeView>("recipe", recipeId);
    if (!record) throw new DataAdapterError("Recipe not found.", 404, "RECIPE_NOT_FOUND");
    const updated: RecipeView = { ...record.data, ...input, id: record.data.id, updatedAt: now() };
    await this.saveRecord("recipe", recipeId, updated, updated.createdAt.slice(0, 10), record.createdAt);
    return updated;
  }

  async generateRecipes(input: { scanId?: string; sourceRecipeId?: string; manualIngredients?: string[]; locale: "en" | "zh-CN"; preferences: import("../domain").RecipePreferenceInput }) {
    let ingredients: any[] = [];
    let sourceScanId: string | null = null;

    if (input.scanId) {
      const scan = await this.getRecord<IngredientScanView>("ingredient-scan", input.scanId);
      if (!scan) throw new DataAdapterError("Ingredient scan not found.", 404, "SCAN_NOT_FOUND");
      ingredients = scan.data.ingredients;
      sourceScanId = scan.data.id;
    } else if (input.sourceRecipeId) {
      const recipe = await this.getRecord<RecipeView>("recipe", input.sourceRecipeId);
      if (!recipe) throw new DataAdapterError("Recipe not found.", 404, "RECIPE_NOT_FOUND");
      ingredients = recipe.data.ingredients;
    } else if (input.manualIngredients?.length) {
      ingredients = input.manualIngredients.map(name => ({ normalizedName: name, displayNameEn: name, displayNameZh: name }));
    }

    // The deterministic fallback is intentionally used while the cloud recipe
    // endpoint is being extracted. It keeps the local free tier functional
    // without a device-side Node runtime or a hidden server key.
    const generated = generateFallbackRecipes({
      locale: input.locale,
      ingredients,
      pairings: [],
      preferences: input.preferences
    });
    const saved = generated.map((recipe) => {
      const createdAt = now();
      const id = newId("recipe");
      const value: RecipeView = {
        id,
        profileId: this.profileId,
        sourceScanId,
        cuisineStyle: recipe.cuisineStyle,
        difficulty: recipe.difficulty,
        referenceImageQuery: recipe.referenceImageQuery ?? null,
        referenceImage: null,
        estimatedCookingMinutes: recipe.estimatedCookingMinutes,
        servings: recipe.servings,
        estimatedCaloriesPerServing: recipe.estimatedCaloriesPerServing ?? null,
        estimatedProteinGramsPerServing: recipe.estimatedProteinGramsPerServing ?? null,
        estimatedCarbsGramsPerServing: recipe.estimatedCarbsGramsPerServing ?? null,
        estimatedFatGramsPerServing: recipe.estimatedFatGramsPerServing ?? null,
        isFavorite: false,
        createdAt,
        updatedAt: createdAt,
        translations: recipe.translations,
        ingredients: recipe.ingredients.map((ingredient, position) => ({ ...ingredient, id: newId("recipe-ingredient"), position })),
        steps: recipe.steps.map((step) => ({ ...step, id: newId("recipe-step") })),
        tips: recipe.tips.map((tip, position) => ({ ...tip, id: newId("recipe-tip"), position })),
        missingIngredients: recipe.missingIngredients.map((ingredient) => ({ ...ingredient, id: newId("recipe-missing") }))
      };
      return value;
    });
    await Promise.all(saved.map((recipe) => this.saveRecord("recipe", recipe.id, recipe, recipe.createdAt.slice(0, 10), recipe.createdAt)));
    return saved;
  }

  async getWater(date: string): Promise<WaterSummary> {
    const [settings, entries, target] = await Promise.all([
      this.getSettings(),
      this.listRecordsForDate<WaterSummary["entries"][number]>("water-entry", date),
      this.getRecord<{ targetMl: number }>("water-target", date)
    ]);
    const waterEntries = entries.map((record) => record.data).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return {
      date,
      entries: waterEntries,
      totalMl: waterEntries.reduce((total, entry) => total + entry.amountMl, 0),
      targetMl: target?.data.targetMl ?? settings.defaultWaterTargetMl
    };
  }

  async addWater(input: { date: string; amountMl: number }) {
    const amountMl = Math.round(input.amountMl);
    if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 5000) {
      throw new DataAdapterError("Enter a water amount between 1 and 5000 ml.", 400, "INVALID_WATER_AMOUNT");
    }
    const createdAt = now();
    const entry: WaterSummary["entries"][number] = { id: newId("water"), amountMl, createdAt };
    await this.saveRecord("water-entry", entry.id, entry, input.date, createdAt);
    return this.getWater(input.date);
  }

  async setWaterTarget(input: { date: string; targetMl: number }) {
    const targetMl = Math.round(input.targetMl);
    if (!Number.isFinite(targetMl) || targetMl < 250 || targetMl > 20000) {
      throw new DataAdapterError("Enter a water target between 250 and 20000 ml.", 400, "INVALID_WATER_TARGET");
    }
    const existing = await this.getRecord<{ targetMl: number }>("water-target", input.date);
    await this.saveRecord("water-target", input.date, { targetMl }, input.date, existing?.createdAt ?? now());
    return this.getWater(input.date);
  }

  async resetWater(date: string) {
    await this.deleteRecordsForDate("water-entry", date);
    return this.getWater(date);
  }

  async getFoodLogs(date: string) {
    const logs = (await this.listRecordsForDate<FoodLogView>("food-log", date)).map((record) => record.data);
    const total = logs.reduce((sum, item) => sum + (item.calories ?? 0), 0);
    const nutritionSummary = buildNutritionSummary(logs, total);
    const { profile } = await this.ensureProfile();
    const calorieTarget = calculateDailyCalorieTarget(profile).targetCalories;
    return { logs, total, nutritionSummary, calorieTarget };
  }

  async saveFoodLog(input: Omit<FoodLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const id = input.id ?? newId("food");
    const existing = await this.getRecord<FoodLogView>("food-log", id);
    const createdAt = existing?.data.createdAt ?? now();
    const value: FoodLogView = {
      ...input,
      id,
      nameEn: input.nameEn.trim(),
      nameZh: input.nameZh?.trim() || null,
      notes: input.notes?.trim() || null,
      createdAt,
      updatedAt: now()
    };
    if (!value.nameEn) throw new DataAdapterError("Enter a food name.", 400, "INVALID_FOOD_LOG");
    await this.saveRecord("food-log", id, value, value.date, existing?.createdAt ?? createdAt);
    return this.getFoodLogs(value.date);
  }

  async deleteFoodLog(id: string, date: string) {
    const deleted = await this.deleteRecord("food-log", id);
    const logs = (await this.listRecordsForDate<FoodLogView>("food-log", date)).map((record) => record.data);
    const total = logs.reduce((sum, item) => sum + (item.calories ?? 0), 0);
    return { deleted, total };
  }

  async estimateNutrition(input: { nameEn: string; nameZh?: string | null }): Promise<import("../domain").FoodNutritionEstimate> {
    const aiSettings = await this.getAiSettings();
    const apiKey = await SecureStore.getItemAsync(keyName(aiSettings.provider, this.profileId));
    if (!apiKey) throw new DataAdapterError(`Add your ${aiSettings.provider === "gemini" ? "Gemini" : "OpenAI"} API key in Profile before estimating.`, 400, "LOCAL_AI_KEY_REQUIRED");

    const name = input.nameEn || input.nameZh;
    const prompt = `Estimate nutrition for "${name}". Return JSON only: { "calories": number, "proteinGrams": number, "carbsGrams": number, "fatGrams": number, "confidence": "high"|"medium"|"low", "notesEn": string, "notesZh": string }.`;

    let output = "";
    if (aiSettings.provider === "gemini") {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (!response.ok) throw new DataAdapterError("Gemini could not estimate nutrition.", response.status, "AI_REQUEST_FAILED");
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    } else {
      // Basic OpenAI support for estimation
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) throw new DataAdapterError("OpenAI could not estimate nutrition.", response.status, "AI_REQUEST_FAILED");
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      output = payload.choices?.[0]?.message?.content ?? "";
    }

    try {
      return JSON.parse(output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as import("../domain").FoodNutritionEstimate;
    } catch {
      throw new DataAdapterError("AI returned an invalid estimation result.", 502, "AI_INVALID_RESPONSE");
    }
  }

  async getExercise(date: string) {
    return (await this.listRecordsForDate<ExerciseLogView>("exercise", date)).map((record) => record.data);
  }

  async saveExercise(input: Omit<ExerciseLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const id = input.id ?? newId("exercise");
    const existing = await this.getRecord<ExerciseLogView>("exercise", id);
    const createdAt = existing?.data.createdAt ?? now();
    const durationMinutes = Math.round(input.durationMinutes);
    if (!input.type.trim() || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      throw new DataAdapterError("Enter an activity and a valid duration.", 400, "INVALID_EXERCISE_LOG");
    }
    const value: ExerciseLogView = {
      ...input,
      id,
      type: input.type.trim(),
      durationMinutes,
      estimatedCaloriesBurned: input.estimatedCaloriesBurned == null ? null : Math.max(0, Math.round(input.estimatedCaloriesBurned)),
      notes: input.notes?.trim() || null,
      createdAt,
      updatedAt: now()
    };
    await this.saveRecord("exercise", id, value, value.date, existing?.createdAt ?? createdAt);
    return value;
  }

  async deleteExercise(id: string) {
    return this.deleteRecord("exercise", id);
  }

  async getHistory(date: string): Promise<DailyHistoryView> {
    const [foodLogs, water, exerciseLogs, scanRecords, recipeRecords] = await Promise.all([
      this.getFoodLogs(date),
      this.getWater(date),
      this.getExercise(date),
      this.listRecordsForDate<IngredientScanView>("ingredient-scan", date),
      this.listRecordsForDate<RecipeView>("recipe", date)
    ]);
    return {
      date,
      foodLogs: foodLogs.logs,
      dailyCalories: foodLogs.total,
      water,
      exerciseLogs,
      exerciseMinutes: exerciseLogs.reduce((total, entry) => total + entry.durationMinutes, 0),
      sleep: null,
      weight: null,
      scans: scanRecords.map((record) => record.data),
      recipes: recipeRecords.map((record) => record.data)
    };
  }

  async deleteHistory(date: string) {
    const db = await this.database();
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM health_records WHERE profile_id = ? AND record_date = ?", [this.profileId, date]);
    });
    return true;
  }

  async exportBackup(): Promise<unknown> {
    const db = await this.database();
    const rows = await db.getAllAsync<{ record_type: string; record_id: string; record_date: string | null; data_json: string; created_at: string; updated_at: string }>(
      "SELECT record_type, record_id, record_date, data_json, created_at, updated_at FROM health_records WHERE profile_id = ?",
      [this.profileId]
    );
    return {
      kind: "daily-health-backup",
      version: 2,
      exportedAt: now(),
      profileId: this.profileId,
      data: { records: rows }
    };
  }

  async importBackup(backup: any): Promise<{ summary: { records: number } }> {
    if (backup?.kind !== "daily-health-backup" || !Array.isArray(backup?.data?.records)) {
      throw new Error("Invalid backup file.");
    }
    const db = await this.database();
    const records = backup.data.records;
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM health_records WHERE profile_id = ?", [this.profileId]);
      for (const row of records) {
        await db.runAsync(
          "INSERT INTO health_records (record_type, record_id, profile_id, record_date, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [row.record_type, row.record_id, this.profileId, row.record_date, row.data_json, row.created_at, row.updated_at]
        );
      }
    });
    return { summary: { records: records.length } };
  }
}
