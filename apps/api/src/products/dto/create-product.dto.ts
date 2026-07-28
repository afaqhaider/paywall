import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import type { Prisma } from "@prisma/client";
import { ProductVisibility } from "@prisma/client";

export class CreateProductDto {
  @IsUUID()
  applicationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProductVisibility)
  visibility?: ProductVisibility;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
