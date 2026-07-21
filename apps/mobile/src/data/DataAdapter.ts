import type {
  ActivityLevel,
  AppLocale,
  CalorieGoal,
  DailyHistoryView,
  ExerciseLogView,
  FoodLogView,
  IngredientScanView,
  ProfileGender,
  RecognizedIngredientInput,
  RecipePreferenceInput,
  RecipeView,
  SleepLogView,
  ThemeMode,
  UserProfileView,
  WaterSummary,
  WeightLogView
} from "../domain";

export type ProfileInput = {
  displayName?: string | null;
  gender?: ProfileGender | null;
  birthYear?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: ActivityLevel;
  calorieGoal?: CalorieGoal;
  dailyCalorieTarget?: number | null;
};

export type Settings = {
  locale: AppLocale;
  theme: ThemeMode;
  defaultWaterTargetMl: number;
};

export type AiProvider = "gemini" | "openai";

export type AiSettings = {
  provider: AiProvider;
  model: string;
  configured: boolean;
  profileKeyConfigured: boolean;
  environmentKeyConfigured: false;
  providers: Record<AiProvider, { configured: boolean; profileKeyConfigured: boolean }>;
};

export type AiSettingsInput = {
  provider: AiProvider;
  apiKey?: string;
  clearApiKey?: boolean;
};

export type ServiceStatusItem = {
  id: string;
  state: "ok" | "warning" | "error";
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  detailsEn: string[];
  detailsZh: string[];
};

export type ServiceStatusResponse = {
  overall: "ok" | "warning" | "error";
  checkedAt: string;
  items: ServiceStatusItem[];
};

export type ImageInput = {
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** A data URI is deliberate: it works in native, on web, and in a future multipart remote adapter. */
  dataUrl: string;
};

export type IngredientScanInput = {
  image: ImageInput;
  locale: AppLocale;
};

/**
 * This is the only data contract a screen may depend on. New migrated screens
 * add their operation here before adding storage or HTTP code.
 */
export interface DataAdapter {
  readonly mode: "local" | "remote" | "mirror";

  ensureProfile(): Promise<{ profile: UserProfileView; settings: Settings }>;
  getProfile(): Promise<UserProfileView>;
  saveProfile(input: ProfileInput): Promise<UserProfileView>;
  getSettings(): Promise<Settings>;
  saveSettings(input: Partial<Settings>): Promise<Settings>;
  getAiSettings(): Promise<AiSettings>;
  saveAiSettings(input: AiSettingsInput): Promise<AiSettings>;
  getServiceStatus(): Promise<ServiceStatusResponse>;
  getErrorLogs(limit?: number): Promise<import("../domain").AppErrorLogView[]>;
  logError(input: { source: string; severity: string; message: string; data?: any }): Promise<void>;

  analyzeIngredients(input: IngredientScanInput): Promise<IngredientScanView>;
  getIngredientScans(): Promise<IngredientScanView[]>;
  saveIngredientScan(
    scanId: string,
    input: { ingredients: RecognizedIngredientInput[]; confirmed?: boolean }
  ): Promise<IngredientScanView>;

  getIngredientScan(scanId: string): Promise<IngredientScanView | null>;
  getRecipes(options?: { favorites?: boolean }): Promise<RecipeView[]>;
  saveRecipe(recipeId: string, input: Partial<RecipeView>): Promise<RecipeView>;
  generateRecipes(input: { scanId?: string; sourceRecipeId?: string; manualIngredients?: string[]; locale: AppLocale; preferences: RecipePreferenceInput }): Promise<RecipeView[]>;

  getWater(date: string): Promise<WaterSummary>;
  addWater(input: { date: string; amountMl: number }): Promise<WaterSummary>;
  setWaterTarget(input: { date: string; targetMl: number }): Promise<WaterSummary>;
  resetWater(date: string): Promise<WaterSummary>;

  getFoodLogs(date: string): Promise<{ logs: FoodLogView[]; total: number; nutritionSummary: NutritionSummaryView; calorieTarget: number | null }>;
  saveFoodLog(input: Omit<FoodLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<{ logs: FoodLogView[]; total: number; nutritionSummary: NutritionSummaryView; calorieTarget: number | null }>;
  deleteFoodLog(id: string, date: string): Promise<{ deleted: boolean; total: number }>;
  estimateNutrition(input: { nameEn: string; nameZh?: string | null }): Promise<FoodNutritionEstimate>;

  getExercise(date: string): Promise<ExerciseLogView[]>;
  saveExercise(input: Omit<ExerciseLogView, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ExerciseLogView>;
  deleteExercise(id: string): Promise<boolean>;

  getHistory(date: string): Promise<DailyHistoryView>;
  deleteHistory(date: string): Promise<boolean>;

  exportBackup(): Promise<unknown>;
  importBackup(backup: unknown): Promise<{ summary: { records: number } }>;
}

export class DataAdapterError extends Error {
  constructor(message: string, readonly statusCode: number | null = null, readonly code?: string) {
    super(message);
    this.name = "DataAdapterError";
  }
}
