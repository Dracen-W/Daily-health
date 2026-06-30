import { prisma } from "@/lib/db";
import { profileIdSchema } from "@/lib/validation/schemas";

export async function ensureProfile(profileId: string) {
  const id = profileIdSchema.parse(profileId);

  await prisma.profile.upsert({
    where: { id },
    update: {},
    create: { id }
  });

  const settings = await prisma.appSettings.upsert({
    where: { profileId: id },
    update: {},
    create: {
      profileId: id,
      locale: "en",
      theme: "light",
      defaultWaterTargetMl: 2000
    }
  });

  return {
    profile: await prisma.profile.findUniqueOrThrow({ where: { id } }),
    settings
  };
}

export async function deleteProfile(profileId: string) {
  return prisma.profile.delete({ where: { id: profileId } });
}
