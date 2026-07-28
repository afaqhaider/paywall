import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

/** Grants a complimentary subscription directly, bypassing payment. */
export class GrantComplimentaryDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  planId!: string;

  @IsUUID()
  priceId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  /** If set, overrides the price's normal billing interval and sets
   * `currentPeriodEnd` to exactly `now + durationDays` instead - the whole
   * point of a complimentary grant is that it doesn't have to follow the
   * plan's normal billing cadence. */
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;
}
