import { SetMetadata } from "@nestjs/common";
import type { OrganizationRole } from "@prisma/client";

export const ORG_ROLE_KEY = "requiredOrgRole";

/**
 * Marks a route as requiring at least the given role within the organization
 * identified by the `:organizationId` route param. Enforced by OrganizationRoleGuard.
 */
export const RequireOrgRole = (role: OrganizationRole) => SetMetadata(ORG_ROLE_KEY, role);
