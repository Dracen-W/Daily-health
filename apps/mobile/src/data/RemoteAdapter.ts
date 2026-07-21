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
  type AiSettings,
  type AiSettingsInput,
  type DataAdapter,
  DataAdapterError,
  type IngredientScanInput,
  type ProfileInput,
  type Settings
} from "./DataAdapter";

type RemoteAdapterOptions = {
  baseUrl: string;
  profileId: string;
  accessToken?: string | null;
};

/**
 * Cloud transport. It deliberately contains no SQLite or platform branches.
 * The cloud derives identity from the Bearer token; a profile ID is never an
 * authorization credential.
 */
export class RemoteAdapter implements DataAdapter {
  readonly mode = "remote" as const;

  constructor(private readonly options: RemoteAdapterOptions) {}

  private async request<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (this.options.accessToken) headers.set("authorization", `Bearer ${this.options.accessToken}`);
    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      response = await fetch(new URL(path, this.options.baseUrl).toString(), { ...init, headers, signal: controller.signal });
      clearTimeout(timeout);
    } catch (err: any) {
      if (err.name === "AbortError") throw new DataAdapterError("Request to cloud service timed out.", 408, "REMOTE_TIMEOUT");
      throw new DataAdapterError("Unable to reach the Daily Health cloud service.", null, "REMOTE_OFFLINE");
    }
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new DataAdapterError("The cloud service returned an invalid response.", response.status, "REMOTE_INVALID_RESPONSE");
    }
    if (!response.ok) {
      const message = typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : "Cloud request failed.";
      throw new DataAdapterError(message, response.status, "REMOTE_REQUEST_FAILED");
    }
    return data as T;
  }

  async ensureProfile() {
    return this.request<{ profile: UserProfileView; settings: Settings }>("/api/profile", {
      method: "POST",
      body: JSON.stringify({ profileId: this.options.profileId })
    });
  }

  async getProfile() {
    return (await this.request<{ profile: UserProfileView }>("/api/profile")).profile;
  }

  async saveProfile(input: ProfileInput) {
    return (await this.request<{ profile: UserProfileView }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).profile;
  }

  async getSettings() {
    return (await this.request<{ settings: Settings }>("/api/settings")).settings;
  }

  async saveSettings(input: Partial<Settings>) {
    return (await this.request<{ settings: Settings }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).settings;
  }

  async getAiSettings() {
    return (await this.request<{ aiSettings: AiSettings }>("/api/ai-settings")).aiSettings;
  }

  async saveAiSettings(input: AiSettingsInput) {
    return (await this.request<{ aiSettings: AiSettings }>("/api/ai-settings", {
      method: "PATCH",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).aiSettings;
  }

  async getServiceStatus() {
    return this.request<import("./DataAdapter").ServiceStatusResponse>("/api/service-status");
  }

  async getErrorLogs(limit = 10) {
    return (await this.request<{ logs: import("../domain").AppErrorLogView[] }>(`/api/error-logs?limit=${limit}`)).logs;
  }

  async logError(input: { source: string; severity: string; message: string; data?: any }) {
    await this.request("/api/log-error", {
      method: "POST",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    });
  }

  async analyzeIngredients(input: IngredientScanInput) {
    return (await this.request<{ scan: IngredientScanView }>("/api/analyze-ingredients", {
      method: "POST",
      body: JSON.stringify({
        profileId: this.options.profileId,
        locale: input.locale,
        imageName: input.image.fileName,
        imageMimeType: input.image.mimeType,
        imageDataUrl: input.image.dataUrl
      })
    })).scan;
  }

  async getIngredientScans() {
    return (await this.request<{ scans: IngredientScanView[] }>("/api/ingredient-scans")).scans;
  }

  async getIngredientScan(scanId: string) {
    // Currently server doesn't have a single-scan GET, so we filter from list
    const scans = await this.getIngredientScans();
    return scans.find((s) => s.id === scanId) ?? null;
  }

  async saveIngredientScan(scanId: string, input: { ingredients: RecognizedIngredientInput[]; confirmed?: boolean }) {
    return (await this.request<{ scan: IngredientScanView }>(`/api/ingredient-scans/${encodeURIComponent(scanId)}`, {
      method: "PATCH",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).scan;
  }

  async getRecipes(options?: { favorites?: boolean }) {
    const path = options?.favorites ? "/api/recipes?favorites=1" : "/api/recipes";
    return (await this.request<{ recipes: RecipeView[] }>(path)).recipes;
  }

  async saveRecipe(recipeId: string, input: Partial<RecipeView>) {
    return (await this.request<{ recipe: RecipeView }>(`/api/recipes/${encodeURIComponent(recipeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).recipe;
  }

  async generateRecipes(input: { scanId?: string; sourceRecipeId?: string; manualIngredients?: string[]; locale: "en" | "zh-CN"; preferences: import("../domain").RecipePreferenceInput }) {
    return (await this.request<{ recipes: RecipeView[] }>("/api/generate-recipes", {
      method: "POST",
      body: JSON.stringify({
        profileId: this.options.profileId,
        ...input,
        allowLocalFallback: true
      })
    })).recipes;
  }

  async getWater(date: string) {
    return (await this.request<{ water: WaterSummary }>(`/api/water?date=${encodeURIComponent(date)}`)).water;
  }

  async addWater(input: { date: string; amountMl: number }) {
    return (await this.request<{ water: WaterSummary }>("/api/water", {
      method: "POST",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).water;
  }

  async setWaterTarget(input: { date: string; targetMl: number }) {
    return (await this.request<{ water: WaterSummary }>("/api/water", {
      method: "PATCH",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).water;
  }

  async resetWater(date: string) {
    return (await this.request<{ water: WaterSummary }>("/api/water", {
      method: "DELETE",
      body: JSON.stringify({ profileId: this.options.profileId, date })
    })).water;
  }

  async getFoodLogs(date: string) {
    return this.request<{ logs: FoodLogView[]; total: number; nutritionSummary: import("../domain").NutritionSummaryView; calorieTarget: number | null }>(`/api/food-logs?date=${encodeURIComponent(date)}`);
  }

  async saveFoodLog(input: Omit<FoodLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const { id, ...value } = input;
    return this.request<{ logs: FoodLogView[]; total: number; nutritionSummary: import("../domain").NutritionSummaryView; calorieTarget: number | null }>("/api/food-logs", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify({ profileId: this.options.profileId, ...(id ? { id } : {}), ...value })
    });
  }

  async deleteFoodLog(id: string, date: string) {
    return this.request<{ deleted: boolean; total: number }>("/api/food-logs", {
      method: "DELETE",
      body: JSON.stringify({ profileId: this.options.profileId, id, date })
    });
  }

  async estimateNutrition(input: { nameEn: string; nameZh?: string | null }) {
    return (await this.request<{ estimate: import("../domain").FoodNutritionEstimate }>("/api/estimate-nutrition", {
      method: "POST",
      body: JSON.stringify({ profileId: this.options.profileId, ...input })
    })).estimate;
  }

  async getExercise(date: string) {
    return (await this.request<{ logs: ExerciseLogView[] }>(`/api/exercise?date=${encodeURIComponent(date)}`)).logs;
  }

  async saveExercise(input: Omit<ExerciseLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const { id, ...value } = input;
    return (await this.request<{ log: ExerciseLogView }>("/api/exercise", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify({ profileId: this.options.profileId, ...(id ? { id } : {}), ...value })
    })).log;
  }

  async deleteExercise(id: string) {
    return (await this.request<{ deleted: boolean }>("/api/exercise", {
      method: "DELETE",
      body: JSON.stringify({ profileId: this.options.profileId, id })
    })).deleted;
  }

  async getHistory(date: string) {
    return (await this.request<{ history: DailyHistoryView }>(`/api/history/${encodeURIComponent(date)}`)).history;
  }

  async deleteHistory(date: string) {
    return (await this.request<{ deleted: boolean }>(`/api/history/${encodeURIComponent(date)}`, {
      method: "DELETE",
      body: JSON.stringify({ profileId: this.options.profileId })
    })).deleted;
  }

  async exportBackup() {
    return this.request<unknown>("/api/backup");
  }

  async importBackup(backup: unknown) {
    return this.request<{ summary: { records: number } }>("/api/backup", {
      method: "POST",
      body: JSON.stringify({ backup })
    });
  }
}
