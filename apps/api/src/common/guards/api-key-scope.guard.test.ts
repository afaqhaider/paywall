import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { ApiKeyScopeGuard } from "./api-key-scope.guard";

function makeContext(scopes: string[] | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ apiKeyContext: scopes ? { scopes } : undefined }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(requiredScope: string | undefined): Reflector {
  return { getAllAndOverride: () => requiredScope } as unknown as Reflector;
}

describe("ApiKeyScopeGuard", () => {
  it("allows the request through when the route requires no scope", () => {
    const guard = new ApiKeyScopeGuard(makeReflector(undefined));

    expect(guard.canActivate(makeContext(["entitlements:read"]))).toBe(true);
  });

  it("allows the request when the key holds the exact required scope", () => {
    const guard = new ApiKeyScopeGuard(makeReflector("entitlements:write"));

    expect(guard.canActivate(makeContext(["entitlements:read", "entitlements:write"]))).toBe(true);
  });

  it("allows the request when the key holds the wildcard scope", () => {
    const guard = new ApiKeyScopeGuard(makeReflector("licenses:read"));

    expect(guard.canActivate(makeContext(["*"]))).toBe(true);
  });

  it("rejects the request when the key is missing the required scope", () => {
    const guard = new ApiKeyScopeGuard(makeReflector("licenses:read"));

    expect(() => guard.canActivate(makeContext(["entitlements:read"]))).toThrow(ForbiddenException);
  });

  it("rejects the request when no api key context is present at all", () => {
    const guard = new ApiKeyScopeGuard(makeReflector("licenses:read"));

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
