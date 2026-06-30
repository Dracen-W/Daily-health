import { prisma } from "@/lib/db";
import type { ExerciseLogView } from "@/lib/types/domain";
import { serializeExercise } from "./serializers";

export async function listExerciseLogs(profileId: string, date: string) {
  const logs = await prisma.exerciseLog.findMany({
    where: { profileId, date },
    orderBy: { createdAt: "asc" }
  });
  return logs.map(serializeExercise);
}

export async function createExerciseLog(input: {
  profileId: string;
  type: string;
  durationMinutes: number;
  estimatedCaloriesBurned?: number | null;
  date: string;
  notes?: string | null;
}) {
  const log = await prisma.exerciseLog.create({
    data: input
  });
  return serializeExercise(log);
}

export async function updateExerciseLog(input: {
  id: string;
  profileId: string;
  type: string;
  durationMinutes: number;
  estimatedCaloriesBurned?: number | null;
  date: string;
  notes?: string | null;
}) {
  const existing = await prisma.exerciseLog.findFirst({
    where: { id: input.id, profileId: input.profileId }
  });
  if (!existing) {
    return null;
  }
  const log = await prisma.exerciseLog.update({
    where: { id: input.id },
    data: {
      type: input.type,
      durationMinutes: input.durationMinutes,
      estimatedCaloriesBurned: input.estimatedCaloriesBurned,
      date: input.date,
      notes: input.notes
    }
  });
  return serializeExercise(log);
}

export async function deleteExerciseLog(profileId: string, id: string) {
  const existing = await prisma.exerciseLog.findFirst({ where: { id, profileId } });
  if (!existing) {
    return false;
  }
  await prisma.exerciseLog.delete({ where: { id } });
  return true;
}

export function calculateExerciseMinutes(logs: ExerciseLogView[]) {
  return logs.reduce((sum, log) => sum + log.durationMinutes, 0);
}
