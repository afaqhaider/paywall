import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  let healthService: HealthService;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { $queryRaw: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    healthService = moduleRef.get(HealthService);
  });

  it("reports database as up when the query succeeds", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const result = await healthService.check();

    expect(result.status).toBe("ok");
    expect(result.database).toBe("up");
  });

  it("reports database as down when the query throws", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const result = await healthService.check();

    expect(result.status).toBe("error");
    expect(result.database).toBe("down");
  });
});
