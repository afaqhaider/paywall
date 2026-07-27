import { ApplicationMemberRole } from "@prisma/client";

/** Higher number = more privileged. */
const ROLE_RANK: Record<ApplicationMemberRole, number> = {
  VIEWER: 0,
  SUPPORT: 1,
  TESTER: 1,
  DEVELOPER: 2,
  ADMINISTRATOR: 3,
  OWNER: 4,
};

export function roleAtLeast(role: ApplicationMemberRole, minimum: ApplicationMemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function compareRoles(a: ApplicationMemberRole, b: ApplicationMemberRole): number {
  return ROLE_RANK[a] - ROLE_RANK[b];
}
