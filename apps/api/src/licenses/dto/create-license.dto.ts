import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsUUID, Min } from "class-validator";
import type { Prisma } from "@prisma/client";
import { LicenseType } from "@prisma/client";

export class CreateLicenseDto {
  @IsUUID()
  applicationId!: string;

  @IsEnum(LicenseType)
  type!: LicenseType;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seatLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  deviceLimit?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
