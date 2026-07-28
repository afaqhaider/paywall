import { AnalyticsMetric, AnalyticsPeriod, AnalyticsScope } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Query params for `GET /admin/analytics/platform`. `scope` defaults to
 * PLATFORM (no organization/application filter); pass ORGANIZATION +
 * `organizationId` or APPLICATION + `applicationId` to narrow the same
 * metric to one tenant - the platform-admin guard on this route just means
 * "may query any scope", not "may only query PLATFORM".
 */
export class AnalyticsQueryDto {
  @IsEnum(AnalyticsMetric)
  metric!: AnalyticsMetric;

  @IsOptional()
  @IsEnum(AnalyticsScope)
  scope?: AnalyticsScope;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  /** ISO date/datetime - inclusive lower bound. Defaults based on `period` when omitted. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** ISO date/datetime - exclusive upper bound. Defaults to now when omitted. */
  @IsOptional()
  @IsDateString()
  to?: string;

  /** When true, also upserts the result into `AnalyticsSnapshot` for reuse. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  cache?: boolean;
}
