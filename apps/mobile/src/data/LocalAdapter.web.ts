import type { DataAdapter } from "./DataAdapter";
import { DataAdapterError } from "./DataAdapter";

/**
 * The hosted web build is cloud-only. Keep Expo's native SQLite module out of
 * Metro's web graph; it is loaded by LocalAdapter.ts on Android instead.
 */
export class LocalAdapter implements DataAdapter {
  readonly mode = "local" as const;

  constructor(readonly profileId: string) {}

  private unavailable(): Promise<never> {
    return Promise.reject(
      new DataAdapterError("Local-only storage is available in the Android app. Use a cloud session in the web version.", 501, "WEB_LOCAL_UNAVAILABLE")
    );
  }

  ensureProfile: DataAdapter["ensureProfile"] = () => this.unavailable();
  getProfile: DataAdapter["getProfile"] = () => this.unavailable();
  saveProfile: DataAdapter["saveProfile"] = () => this.unavailable();
  getSettings: DataAdapter["getSettings"] = () => this.unavailable();
  saveSettings: DataAdapter["saveSettings"] = () => this.unavailable();
  getAiSettings: DataAdapter["getAiSettings"] = () => this.unavailable();
  saveAiSettings: DataAdapter["saveAiSettings"] = () => this.unavailable();
  getServiceStatus: DataAdapter["getServiceStatus"] = () => this.unavailable();
  getErrorLogs: DataAdapter["getErrorLogs"] = () => this.unavailable();
  logError: DataAdapter["logError"] = () => this.unavailable();

  analyzeIngredients: DataAdapter["analyzeIngredients"] = () => this.unavailable();
  getIngredientScans: DataAdapter["getIngredientScans"] = () => this.unavailable();
  saveIngredientScan: DataAdapter["saveIngredientScan"] = () => this.unavailable();
  getIngredientScan: DataAdapter["getIngredientScan"] = () => this.unavailable();

  getRecipes: DataAdapter["getRecipes"] = () => this.unavailable();
  saveRecipe: DataAdapter["saveRecipe"] = () => this.unavailable();
  generateRecipes: DataAdapter["generateRecipes"] = () => this.unavailable();

  getWater: DataAdapter["getWater"] = () => this.unavailable();
  addWater: DataAdapter["addWater"] = () => this.unavailable();
  setWaterTarget: DataAdapter["setWaterTarget"] = () => this.unavailable();
  resetWater: DataAdapter["resetWater"] = () => this.unavailable();

  getFoodLogs: DataAdapter["getFoodLogs"] = () => this.unavailable();
  saveFoodLog: DataAdapter["saveFoodLog"] = () => this.unavailable();
  deleteFoodLog: DataAdapter["deleteFoodLog"] = () => this.unavailable();
  estimateNutrition: DataAdapter["estimateNutrition"] = () => this.unavailable();

  getExercise: DataAdapter["getExercise"] = () => this.unavailable();
  saveExercise: DataAdapter["saveExercise"] = () => this.unavailable();
  deleteExercise: DataAdapter["deleteExercise"] = () => this.unavailable();

  getHistory: DataAdapter["getHistory"] = () => this.unavailable();
  deleteHistory: DataAdapter["deleteHistory"] = () => this.unavailable();

  exportBackup: DataAdapter["exportBackup"] = () => this.unavailable();
  importBackup: DataAdapter["importBackup"] = () => this.unavailable();
}
