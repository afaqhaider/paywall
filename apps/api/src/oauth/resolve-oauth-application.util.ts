import { PrismaService } from "../prisma/prisma.service";

/** Resolves the owning Application id for a flattened `:oauthApplicationId` route, for use with `ApplicationScopedGuard`. */
export const resolveOAuthApplication = async (
  prisma: PrismaService,
  oauthApplicationId: string,
) => {
  const row = await prisma.oAuthApplication.findUnique({
    where: { id: oauthApplicationId },
    select: { applicationId: true },
  });
  return row?.applicationId ?? null;
};
