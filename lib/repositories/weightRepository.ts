import { prisma } from "@/lib/db";
import { serializeWeight } from "./serializers";

export async function getWeightLog(profileId: string, date: string) {
  const log = await prisma.weightLog.findUnique({
    where: { profileId_date: { profileId, date } }
  });
  return log ? serializeWeight(log) : null;
}

export async function getLatestWeightLog(profileId: string) {
  const log = await prisma.weightLog.findFirst({
    where: { profileId },
    orderBy: { date: "desc" }
  });
  return log ? serializeWeight(log) : null;
}

export async function listRecentWeightLogs(profileId: string, take = 7) {
  const logs = await prisma.weightLog.findMany({
    where: { profileId },
    orderBy: { date: "desc" },
    take
  });
  return logs.reverse().map(serializeWeight);
}

export async function upsertWeightLog(input: {
  profileId: string;
  date: string;
  weightKg: number;
  notes?: string | null;
}) {
  const log = await prisma.weightLog.upsert({
    where: { profileId_date: { profileId: input.profileId, date: input.date } },
    update: {
      weightKg: input.weightKg,
      notes: input.notes
    },
    create: input
  });
  return serializeWeight(log);
}

export async function deleteWeightLog(profileId: string, date: string) {
  const existing = await prisma.weightLog.findUnique({
    where: { profileId_date: { profileId, date } }
  });
  if (!existing) {
    return false;
  }
  await prisma.weightLog.delete({
    where: { profileId_date: { profileId, date } }
  });
  return true;
}
