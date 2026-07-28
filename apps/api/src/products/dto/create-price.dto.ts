import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from "class-validator";
import { BillingInterval } from "@prisma/client";

export class CreatePriceDto {
  @IsString()
  @MaxLength(3)
  currency!: string;

  /** Integer minor units (e.g. cents) - never a float. */
  @IsInt()
  @Min(0)
  amountMinor!: number;

  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalCount?: number;

  @IsOptional()
  @IsBoolean()
  taxInclusive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerRef?: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
