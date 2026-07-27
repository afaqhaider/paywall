import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { ApplicationSecretType } from "@prisma/client";

export class CreateApplicationSecretDto {
  @IsEnum(ApplicationSecretType)
  type!: ApplicationSecretType;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  value!: string;

  @IsOptional()
  @IsUUID()
  environmentId?: string;
}
