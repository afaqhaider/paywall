import { randomUUID } from "crypto";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

/**
 * Boots the real Nest application (all modules, guards, pipes) against the
 * real local database and drives it over HTTP via supertest — the same
 * behaviour verified manually with curl during development.
 */
describe("App (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `e2e-${randomUUID()}@apitest.local`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it("GET /health is public and reports database connectivity", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up" });
  });

  it("GET /profile without a token is rejected", async () => {
    await request(app.getHttpServer()).get("/profile").expect(401);
  });

  it("rejects a weak password on registration", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: testEmail, password: "weak" });

    expect(res.status).toBe(400);
  });

  it("registers, logs in, and accesses a protected route with the access token", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: testEmail, password: "SuperSecret123!", firstName: "E2E" })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: testEmail, password: "SuperSecret123!" })
      .expect(200);

    expect(loginRes.body.accessToken).toBeTruthy();
    expect(loginRes.headers["set-cookie"]).toBeDefined();

    const profileRes = await request(app.getHttpServer())
      .get("/profile")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    expect(profileRes.body.email).toBe(testEmail);
  });

  it("refresh without a CSRF header is rejected", async () => {
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: testEmail, password: "SuperSecret123!" });

    const cookies = loginRes.headers["set-cookie"] as unknown as string[];

    await request(app.getHttpServer()).post("/auth/refresh").set("Cookie", cookies).expect(403);
  });
});
