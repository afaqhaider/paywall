import { SetMetadata } from "@nestjs/common";
import type { ApplicationMemberRole } from "@prisma/client";

export const APP_ROLE_KEY = "requiredAppRole";

/**
 * Marks a route as requiring at least the given role within the application
 * identified by the `:applicationId` route param. Enforced by
 * ApplicationRoleGuard, which also grants override access to an
 * OWNER/ADMINISTRATOR of the application's owning organization.
 */
export const RequireAppRole = (role: ApplicationMemberRole) => SetMetadata(APP_ROLE_KEY, role);
