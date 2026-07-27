import { PrismaClient, OrganizationRole } from "@prisma/client";
import { hashPassword } from "../src/common/utils/password.util";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "DemoPassw0rd!2026";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.sszentronics.local" },
    update: {},
    create: {
      email: "owner@demo.sszentronics.local",
      passwordHash,
      firstName: "Dana",
      lastName: "Owner",
      displayName: "Dana Owner",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@demo.sszentronics.local" },
    update: {},
    create: {
      email: "member@demo.sszentronics.local",
      passwordHash,
      firstName: "Milo",
      lastName: "Member",
      displayName: "Milo Member",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "ss-zentronics-demo" },
    update: {},
    create: { name: "SS Zentronics Demo", slug: "ss-zentronics-demo" },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: owner.id } },
    update: {},
    create: { organizationId: organization.id, userId: owner.id, role: OrganizationRole.OWNER },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: member.id } },
    update: {},
    create: { organizationId: organization.id, userId: member.id, role: OrganizationRole.MEMBER },
  });

  /* eslint-disable no-console -- seed script output, not application logging */
  console.log("Seed complete:");
  console.log(`  Organization: ${organization.name} (${organization.slug})`);
  console.log(`  Owner login:  ${owner.email} / ${DEMO_PASSWORD}`);
  console.log(`  Member login: ${member.email} / ${DEMO_PASSWORD}`);
  /* eslint-enable no-console */
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
