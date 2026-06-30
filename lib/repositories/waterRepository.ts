import { prisma } from "@/lib/db";
import { serializeWaterSummary } from "./serializers";

export async function getWaterSummary(profileId: string, date: string) {
  const [settings, target, entries] = await Promise.all([
    prisma.appSettings.findUnique({ where: { profileId } }),
    prisma.waterTarget.findUnique({ where: { profileId_date: { profileId, date } } }),
    prisma.waterEntry.findMany({
      where: { profileId, date },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return serializeWaterSummary(date, entries, target?.targetMl ?? settings?.defaultWaterTargetMl ?? 2000);
}

export async function addWaterEntry(profileId: string, date: string, amountMl: number) {
  await prisma.waterEntry.create({
    data: { profileId, date, amountMl }
  });
  return getWaterSummary(profileId, date);
}

export async function setWaterTarget(profileId: string, date: string, targetMl: number) {
  await prisma.waterTarget.upsert({
    where: { profileId_date: { profileId, date } },
    update: { targetMl },
    create: { profileId, date, targetMl }
  });
  return getWaterSummary(profileId, date);
}

export async function resetWaterEntries(profileId: string, date: string) {
  await prisma.waterEntry.deleteMany({ where: { profileId, date } });
  return getWaterSummary(profileId, date);
}

export async function recentWaterSummaries(profileId: string, dates: string[]) {
  return Promise.all(dates.map((date) => getWaterSummary(profileId, date)));
}
