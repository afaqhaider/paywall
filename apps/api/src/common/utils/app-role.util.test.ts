import { describe, expect, it } from "vitest";
import { ApplicationMemberRole } from "@prisma/client";
import { compareRoles, roleAtLeast } from "./app-role.util";

describe("app-role.util", () => {
  it("ranks OWNER above ADMINISTRATOR above DEVELOPER above VIEWER", () => {
    expect(
      compareRoles(ApplicationMemberRole.OWNER, ApplicationMemberRole.ADMINISTRATOR),
    ).toBeGreaterThan(0);
    expect(
      compareRoles(ApplicationMemberRole.ADMINISTRATOR, ApplicationMemberRole.DEVELOPER),
    ).toBeGreaterThan(0);
    expect(
      compareRoles(ApplicationMemberRole.DEVELOPER, ApplicationMemberRole.VIEWER),
    ).toBeGreaterThan(0);
  });

  it("treats TESTER and SUPPORT as equal rank, both above VIEWER and below DEVELOPER", () => {
    expect(compareRoles(ApplicationMemberRole.TESTER, ApplicationMemberRole.SUPPORT)).toBe(0);
    expect(
      compareRoles(ApplicationMemberRole.TESTER, ApplicationMemberRole.VIEWER),
    ).toBeGreaterThan(0);
    expect(
      compareRoles(ApplicationMemberRole.DEVELOPER, ApplicationMemberRole.TESTER),
    ).toBeGreaterThan(0);
  });

  it("roleAtLeast is true when role meets or exceeds the minimum", () => {
    expect(roleAtLeast(ApplicationMemberRole.OWNER, ApplicationMemberRole.ADMINISTRATOR)).toBe(
      true,
    );
    expect(
      roleAtLeast(ApplicationMemberRole.ADMINISTRATOR, ApplicationMemberRole.ADMINISTRATOR),
    ).toBe(true);
  });

  it("roleAtLeast is false when role is below the minimum", () => {
    expect(roleAtLeast(ApplicationMemberRole.VIEWER, ApplicationMemberRole.SUPPORT)).toBe(false);
    expect(roleAtLeast(ApplicationMemberRole.SUPPORT, ApplicationMemberRole.OWNER)).toBe(false);
  });
});
