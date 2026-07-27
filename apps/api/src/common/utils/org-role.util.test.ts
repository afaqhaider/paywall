import { describe, expect, it } from "vitest";
import { OrganizationRole } from "@prisma/client";
import { compareRoles, roleAtLeast } from "./org-role.util";

describe("org-role.util", () => {
  it("ranks OWNER above ADMINISTRATOR above MEMBER above VIEWER", () => {
    expect(compareRoles(OrganizationRole.OWNER, OrganizationRole.ADMINISTRATOR)).toBeGreaterThan(0);
    expect(compareRoles(OrganizationRole.ADMINISTRATOR, OrganizationRole.MEMBER)).toBeGreaterThan(
      0,
    );
    expect(compareRoles(OrganizationRole.MEMBER, OrganizationRole.VIEWER)).toBeGreaterThan(0);
  });

  it("treats DEVELOPER and MANAGER as equal rank", () => {
    expect(compareRoles(OrganizationRole.DEVELOPER, OrganizationRole.MANAGER)).toBe(0);
  });

  it("roleAtLeast is true when role meets or exceeds the minimum", () => {
    expect(roleAtLeast(OrganizationRole.OWNER, OrganizationRole.ADMINISTRATOR)).toBe(true);
    expect(roleAtLeast(OrganizationRole.ADMINISTRATOR, OrganizationRole.ADMINISTRATOR)).toBe(true);
  });

  it("roleAtLeast is false when role is below the minimum", () => {
    expect(roleAtLeast(OrganizationRole.VIEWER, OrganizationRole.MEMBER)).toBe(false);
    expect(roleAtLeast(OrganizationRole.MEMBER, OrganizationRole.OWNER)).toBe(false);
  });
});
