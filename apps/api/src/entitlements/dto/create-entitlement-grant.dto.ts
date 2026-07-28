import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import type { Prisma } from "@prisma/client";
import { EntitlementGrantSource } from "@prisma/client";

export class CreateEntitlementGrantDto {
  @IsUUID()
  applicationId!: string;

  @IsUUID()
  entitlementDefinitionId!: string;

  @IsOptional()
  @IsEnum(EntitlementGrantSource)
  source?: EntitlementGrantSource;

  @IsOptional()
  @IsBoolean()
  boolValue?: boolean;

  @IsOptional()
  @IsInt()
  numberValue?: number;

  @IsOptional()
  @IsString()
  textValue?: string;

  @IsOptional()
  @IsBoolean()
  isUnlimited?: boolean;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
