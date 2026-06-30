import { prisma } from "@/lib/db";
import type { DailyHistoryView } from "@/lib/types/domain";
import { endOfIsoDate, startOfIsoDate } from "@/lib/utils/date";
import { listExerciseLogs, calculateExerciseMinutes } from "./exerciseRepository";
import { calculateFoodCalories, listFoodLogs } from "./foodLogRepository";
import { listIngredientScansByDate } from "./ingredientScanRepository";
import { listRecipesByDate } from "./recipeRepository";
import { getSleepLog } from "./sleepRepository";
import { getWaterSummary } from "./waterRepository";
import { getWeightLog } from "./weightRepository";

export async function getDailyHistory(profileId: string, date: string): Promise<DailyHistoryView> {
  const [foodLogs, water, exerciseLogs, sleep, weight, scans, recipes] = await Promise.all([
    listFoodLogs(profileId, date),
    getWaterSummary(profileId, date),
    listExerciseLogs(profileId, date),
    getSleepLog(profileId, date),
    getWeightLog(profileId, date),
    listIngredientScansByDate(profileId, date),
    listRecipesByDate(profileId, date)
  ]);

  return {
    date,
    foodLogs,
    dailyCalories: calculateFoodCalories(foodLogs),
    water,
    exerciseLogs,
    exerciseMinutes: calculateExerciseMinutes(exerciseLogs),
    sleep,
    weight,
    scans,
    recipes
  };
}

export async function deleteDailyHealthRecords(profileId: string, date: string) {
  const start = startOfIsoDate(date);
  const end = endOfIsoDate(date);

  await prisma.$transaction([
    prisma.foodLog.deleteMany({ where: { profileId, date } }),
    prisma.waterEntry.deleteMany({ where: { profileId, date } }),
    prisma.waterTarget.deleteMany({ where: { profileId, date } }),
    prisma.exerciseLog.deleteMany({ where: { profileId, date } }),
    prisma.sleepLog.deleteMany({ where: { profileId, date } }),
    prisma.weightLog.deleteMany({ where: { profileId, date } }),
    prisma.ingredientScan.deleteMany({
      where: {
        profileId,
        createdAt: {
          gte: start,
          lte: end
        }
      }
    })
  ]);
}
