import { IsDateString, IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { CouponStatus } from "@prisma/client";

export class UpdateCouponDto {
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
