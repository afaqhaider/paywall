import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import type { Prisma } from "@prisma/client";

export class CreateProviderAccountDto {
  @IsString()
  @MaxLength(255)
  externalAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
