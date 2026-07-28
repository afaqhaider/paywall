import { IsBoolean, IsEnum, IsInt, IsOptional } from "class-validator";
import { UsageResetPolicy } from "@prisma/client";

export class UpsertUsageLimitDto {
  /** Null/omitted means "no numeric ceiling" - meaningful mainly when isUnlimited is false. */
  @IsOptional()
  @IsInt()
  limitValue?: number;

  @IsOptional()
  @IsBoolean()
  isUnlimited?: boolean;

  @IsOptional()
  @IsEnum(UsageResetPolicy)
  resetPolicy?: UsageResetPolicy;
}
