import { prisma } from "@/lib/db";

export async function ensureProfile(profileId: string) {
  await prisma.profile.upsert({
    where: { id: profileId },
    update: {},
    create: { id: profileId }
  });

  const settings = await prisma.appSettings.upsert({
    where: { profileId },
    update: {},
    create: {
      profileId,
      locale: "en",
      theme: "light",
      defaultWaterTargetMl: 2000
    }
  });

  return {
    profile: await prisma.profile.findUniqueOrThrow({ where: { id: profileId } }),
    settings
  };
}

export async function deleteProfile(profileId: string) {
  return prisma.profile.delete({ where: { id: profileId } });
}
