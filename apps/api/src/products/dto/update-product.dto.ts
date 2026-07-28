import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { Prisma } from "@prisma/client";
import { ProductStatus, ProductVisibility } from "@prisma/client";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductVisibility)
  visibility?: ProductVisibility;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
