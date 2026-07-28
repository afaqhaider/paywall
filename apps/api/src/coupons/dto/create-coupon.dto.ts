import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import type { Prisma } from "@prisma/client";
import { CouponDiscountType, CouponDuration } from "@prisma/client";

export class CreateCouponDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountOffMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsEnum(CouponDuration)
  duration?: CouponDuration;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationInCycles?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
