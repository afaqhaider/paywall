import { OrganizationRole } from "@prisma/client";

/** Higher number = more privileged. */
const ROLE_RANK: Record<OrganizationRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  DEVELOPER: 2,
  MANAGER: 2,
  ADMINISTRATOR: 3,
  OWNER: 4,
};

export function roleAtLeast(role: OrganizationRole, minimum: OrganizationRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function compareRoles(a: OrganizationRole, b: OrganizationRole): number {
  return ROLE_RANK[a] - ROLE_RANK[b];
}
