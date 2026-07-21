import type {
  DailyHistoryView,
  ExerciseLogView,
  FoodLogView,
  IngredientScanView,
  RecipeView,
  RecognizedIngredientInput,
  SleepLogView,
  UserProfileView,
  WaterSummary,
  WeightLogView
} from "../domain";
import { LocalAdapter } from "./LocalAdapter";
import type {
  AiSettings,
  AiSettingsInput,
  DataAdapter,
  IngredientScanInput,
  ProfileInput,
  Settings
} from "./DataAdapter";

/**
 * Server-first cache mirror. It never turns a successful cloud write into a
 * failure because a cache write failed. Offline queued writes are intentionally
 * a later sync-manager feature, not silently faked here.
 */
export class MirrorAdapter implements DataAdapter {
  readonly mode = "mirror" as const;
  private isOffline = false;

  constructor(private readonly primary: DataAdapter, private readonly mirror: LocalAdapter) {}

  private async execute<T>(job: (adapter: DataAdapter) => Promise<T>): Promise<T> {
    try {
      const result = await job(this.primary);
      this.isOffline = false;
      return result;
    } catch (error: any) {
      // If it's a network error or timeout, switch to mirror if possible
      if (error instanceof DataAdapterError && (error.code === "REMOTE_OFFLINE" || error.code === "REMOTE_TIMEOUT")) {
        console.warn("MirrorAdapter: Cloud is offline, falling back to local mirror.", error.message);
        this.isOffline = true;
        return job(this.mirror);
      }
      throw error;
    }
  }

  async ensureProfile() {
    return this.execute(async (a) => {
      const value = await a.ensureProfile();
      if (a === this.primary) {
        void this.mirror.saveProfile(value.profile).catch(() => undefined);
        void this.mirror.saveSettings(value.settings).catch(() => undefined);
      }
      return value;
    });
  }

  async getProfile() {
    return this.execute(async (a) => {
      const value = await a.getProfile();
      if (a === this.primary) void this.mirror.saveProfile(value).catch(() => undefined);
      return value;
    });
  }

  async saveProfile(input: ProfileInput): Promise<UserProfileView> {
    return this.execute(async (a) => {
      const value = await a.saveProfile(input);
      if (a === this.primary) void this.mirror.saveProfile(value).catch(() => undefined);
      return value;
    });
  }

  async getSettings() {
    return this.execute(async (a) => {
      const value = await a.getSettings();
      if (a === this.primary) void this.mirror.saveSettings(value).catch(() => undefined);
      return value;
    });
  }

  async saveSettings(input: Partial<Settings>) {
    return this.execute(async (a) => {
      const value = await a.saveSettings(input);
      if (a === this.primary) void this.mirror.saveSettings(value).catch(() => undefined);
      return value;
    });
  }

  getAiSettings(): Promise<AiSettings> {
    return this.execute((a) => a.getAiSettings());
  }

  saveAiSettings(input: AiSettingsInput): Promise<AiSettings> {
    return this.execute((a) => a.saveAiSettings(input));
  }

  async getServiceStatus(): Promise<import("./DataAdapter").ServiceStatusResponse> {
    const value = await this.primary.getServiceStatus().catch(() => null);
    if (!value) {
      const local = await this.mirror.getServiceStatus();
      return {
        ...local,
        overall: "warning",
        items: [
          ...local.items,
          { id: "app", state: "error", titleEn: "Cloud Sync", titleZh: "云端同步", summaryEn: "Offline", summaryZh: "离线", detailsEn: ["Unable to reach server"], detailsZh: ["无法连接服务器"] } as any
        ]
      };
    }
    return value;
  }

  getErrorLogs(limit?: number): Promise<import("../domain").AppErrorLogView[]> {
    return this.execute((a) => a.getErrorLogs(limit));
  }

  logError(input: { source: string; severity: string; message: string; data?: any }): Promise<void> {
    void this.mirror.logError(input).catch(() => undefined);
    return this.primary.logError(input).catch(() => undefined);
  }

  async analyzeIngredients(input: IngredientScanInput) {
    return this.execute(async (a) => {
      const value = await a.analyzeIngredients(input);
      if (a === this.primary) void this.mirror.upsertIngredientScan(value).catch(() => undefined);
      return value;
    });
  }

  async getIngredientScans() {
    return this.execute(async (a) => {
      const value = await a.getIngredientScans();
      if (a === this.primary) {
        for (const scan of value) void this.mirror.upsertIngredientScan(scan).catch(() => undefined);
      }
      return value;
    });
  }

  async getIngredientScan(scanId: string) {
    return this.execute(async (a) => {
      const value = await a.getIngredientScan(scanId);
      if (a === this.primary && value) void this.mirror.upsertIngredientScan(value).catch(() => undefined);
      return value;
    });
  }

  async saveIngredientScan(scanId: string, input: { ingredients: RecognizedIngredientInput[]; confirmed?: boolean }): Promise<IngredientScanView> {
    return this.execute(async (a) => {
      const value = await a.saveIngredientScan(scanId, input);
      if (a === this.primary) void this.mirror.upsertIngredientScan(value).catch(() => undefined);
      return value;
    });
  }

  async getRecipes(options?: { favorites?: boolean }): Promise<RecipeView[]> {
    return this.execute(async (a) => {
      const value = await a.getRecipes(options);
      if (a === this.primary) {
        for (const recipe of value) void this.mirror.upsertRecipe(recipe).catch(() => undefined);
      }
      return value;
    });
  }

  async saveRecipe(recipeId: string, input: Partial<RecipeView>): Promise<RecipeView> {
    return this.execute(async (a) => {
      const value = await a.saveRecipe(recipeId, input);
      if (a === this.primary) void this.mirror.upsertRecipe(value).catch(() => undefined);
      return value;
    });
  }

  async generateRecipes(input: { scanId?: string; sourceRecipeId?: string; manualIngredients?: string[]; locale: "en" | "zh-CN"; preferences: import("../domain").RecipePreferenceInput }): Promise<RecipeView[]> {
    return this.execute(async (a) => {
      const value = await a.generateRecipes(input);
      if (a === this.primary) {
        for (const recipe of value) void this.mirror.upsertRecipe(recipe).catch(() => undefined);
      }
      return value;
    });
  }

  async getWater(date: string): Promise<WaterSummary> {
    return this.execute(async (a) => {
      const value = await a.getWater(date);
      if (a === this.primary) void this.mirror.replaceWaterSummary(value).catch(() => undefined);
      return value;
    });
  }

  async addWater(input: { date: string; amountMl: number }): Promise<WaterSummary> {
    return this.execute(async (a) => {
      const value = await a.addWater(input);
      if (a === this.primary) void this.mirror.replaceWaterSummary(value).catch(() => undefined);
      return value;
    });
  }

  async setWaterTarget(input: { date: string; targetMl: number }): Promise<WaterSummary> {
    return this.execute(async (a) => {
      const value = await a.setWaterTarget(input);
      if (a === this.primary) void this.mirror.replaceWaterSummary(value).catch(() => undefined);
      return value;
    });
  }

  async resetWater(date: string): Promise<WaterSummary> {
    return this.execute(async (a) => {
      const value = await a.resetWater(date);
      if (a === this.primary) void this.mirror.replaceWaterSummary(value).catch(() => undefined);
      return value;
    });
  }

  async getFoodLogs(date: string): Promise<{ logs: FoodLogView[]; total: number; nutritionSummary: import("../domain").NutritionSummaryView; calorieTarget: number | null }> {
    return this.execute(async (a) => {
      const value = await a.getFoodLogs(date);
      if (a === this.primary) {
        for (const log of value.logs) void this.mirror.upsertFoodLog(log).catch(() => undefined);
      }
      return value;
    });
  }

  async saveFoodLog(input: Omit<FoodLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<{ logs: FoodLogView[]; total: number; nutritionSummary: import("../domain").NutritionSummaryView; calorieTarget: number | null }> {
    return this.execute(async (a) => {
      const value = await a.saveFoodLog(input);
      if (a === this.primary) {
        for (const log of value.logs) void this.mirror.upsertFoodLog(log).catch(() => undefined);
      }
      return value;
    });
  }

  async deleteFoodLog(id: string, date: string): Promise<{ deleted: boolean; total: number }> {
    return this.execute(async (a) => {
      const value = await a.deleteFoodLog(id, date);
      if (a === this.primary && value.deleted) void this.mirror.deleteFoodLog(id, date).catch(() => undefined);
      return value;
    });
  }

  estimateNutrition(input: { nameEn: string; nameZh?: string | null }) {
    return this.execute((a) => a.estimateNutrition(input));
  }

  async getExercise(date: string): Promise<ExerciseLogView[]> {
    return this.execute(async (a) => {
      const value = await a.getExercise(date);
      if (a === this.primary) {
        for (const log of value) void this.mirror.upsertExercise(log).catch(() => undefined);
      }
      return value;
    });
  }

  async saveExercise(input: Omit<ExerciseLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ExerciseLogView> {
    return this.execute(async (a) => {
      const value = await a.saveExercise(input);
      if (a === this.primary) void this.mirror.upsertExercise(value).catch(() => undefined);
      return value;
    });
  }

  async deleteExercise(id: string): Promise<boolean> {
    return this.execute(async (a) => {
      const value = await a.deleteExercise(id);
      if (a === this.primary && value) void this.mirror.deleteExercise(id).catch(() => undefined);
      return value;
    });
  }

  async getHistory(date: string): Promise<DailyHistoryView> {
    return this.execute(async (a) => {
      const value = await a.getHistory(date);
      if (a === this.primary) {
        void this.mirror.replaceWaterSummary(value.water).catch(() => undefined);
        for (const item of value.foodLogs) void this.mirror.upsertFoodLog(item).catch(() => undefined);
        for (const item of value.exerciseLogs) void this.mirror.upsertExercise(item).catch(() => undefined);
        for (const item of value.scans) void this.mirror.upsertIngredientScan(item).catch(() => undefined);
        for (const item of value.recipes) void this.mirror.upsertRecipe(item).catch(() => undefined);
      }
      return value;
    });
  }

  async deleteHistory(date: string) {
    return this.execute(async (a) => {
      const value = await a.deleteHistory(date);
      if (a === this.primary && value) void this.mirror.deleteHistory(date).catch(() => undefined);
      return value;
    });
  }

  async exportBackup() {
    return this.execute((a) => a.exportBackup());
  }

  async importBackup(backup: unknown) {
    return this.execute((a) => a.importBackup(backup));
  }
}
