/**
 * Bootstrap script: creates the very first `PlatformAdmin` row.
 *
 * The normal `POST /admin/platform-admins` HTTP route requires an EXISTING
 * platform admin to call it (it's behind `PlatformAdminGuard`), so it can
 * never grant the first admin - that's the bootstrap problem. This script
 * solves it by writing the row directly via Prisma, self-granted
 * (`grantedById = userId`), which is only acceptable for this one bootstrap
 * case - every subsequent grant/revoke should go through the audited HTTP
 * route.
 *
 * Usage (from the repo root, with DATABASE_URL exported):
 *
 *   export DATABASE_URL="postgresql://paywall:paywall_dev_password@localhost:5432/paywall?schema=public"
 *   pnpm --filter api exec tsx scripts/grant-super-admin.ts <email> [role]
 *
 * `<email>` must already belong to an existing User (register the account
 * first via the normal signup flow). `[role]` is optional and defaults to
 * SUPER_ADMIN - it's the only PlatformAdminRole that exists today.
 *
 * Re-running this script for the same email is safe: it upserts, reactivating
 * a previously-revoked grant if one exists rather than erroring.
 */
import { PlatformAdminRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [, , email, roleArg] = process.argv;

  if (!email) {
    console.error("Usage: tsx scripts/grant-super-admin.ts <email> [role]");
    process.exit(1);
  }

  const role = (roleArg as PlatformAdminRole | undefined) ?? PlatformAdminRole.SUPER_ADMIN;
  if (!Object.values(PlatformAdminRole).includes(role)) {
    console.error(
      `Invalid role "${role}". Valid roles: ${Object.values(PlatformAdminRole).join(", ")}`,
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}" - register the account first.`);
    process.exit(1);
  }

  const admin = await prisma.platformAdmin.upsert({
    where: { userId: user.id },
    update: {
      role,
      revokedAt: null,
      revokedById: null,
      grantedAt: new Date(),
      grantedById: user.id,
    },
    create: {
      userId: user.id,
      role,
      grantedById: user.id,
    },
  });

  console.log(
    `Granted ${role} platform admin authority to ${email} (PlatformAdmin.id=${admin.id}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
