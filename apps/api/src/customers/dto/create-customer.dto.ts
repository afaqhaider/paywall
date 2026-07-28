import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import type { Prisma } from "@prisma/client";
import { CustomerType } from "@prisma/client";

export class CreateCustomerDto {
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsObject()
  externalIds?: Prisma.InputJsonValue;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
