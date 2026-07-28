import { AnalyticsPeriod } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional } from "class-validator";

/**
 * Shared date-range filter for the developer-analytics bundle and the
 * executive dashboard - both return a fixed bundle of sub-metrics rather
 * than a single named one, so there's no `metric` field here (see
 * `AnalyticsQueryDto` for the single-metric platform endpoint).
 */
export class DateRangeQueryDto {
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
}
