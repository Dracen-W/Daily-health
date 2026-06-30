import { prisma } from "@/lib/db";
import type { SleepQuality } from "@/lib/types/domain";
import { serializeSleep } from "./serializers";

export async function getSleepLog(profileId: string, date: string) {
  const log = await prisma.sleepLog.findUnique({
    where: { profileId_date: { profileId, date } }
  });
  return log ? serializeSleep(log) : null;
}

export async function getLatestSleepLog(profileId: string) {
  const log = await prisma.sleepLog.findFirst({
    where: { profileId },
    orderBy: { date: "desc" }
  });
  return log ? serializeSleep(log) : null;
}

export async function upsertSleepLog(input: {
  profileId: string;
  date: string;
  hours: number;
  quality: SleepQuality;
  notes?: string | null;
}) {
  const log = await prisma.sleepLog.upsert({
    where: { profileId_date: { profileId: input.profileId, date: input.date } },
    update: {
      hours: input.hours,
      quality: input.quality,
      notes: input.notes
    },
    create: input
  });
  return serializeSleep(log);
}

export async function deleteSleepLog(profileId: string, date: string) {
  const existing = await prisma.sleepLog.findUnique({
    where: { profileId_date: { profileId, date } }
  });
  if (!existing) {
    return false;
  }
  await prisma.sleepLog.delete({
    where: { profileId_date: { profileId, date } }
  });
  return true;
}
