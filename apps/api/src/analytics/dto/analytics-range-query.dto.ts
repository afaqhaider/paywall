import { IsIn, IsOptional } from "class-validator";

export type AnalyticsRange = "daily" | "monthly";

export class AnalyticsRangeQueryDto {
  @IsOptional()
  @IsIn(["daily", "monthly"])
  range?: AnalyticsRange;
}
