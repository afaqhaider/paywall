import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import type { Prisma } from "@prisma/client";
import { PaymentEnvironmentMode, PaymentProviderType } from "@prisma/client";

export class CreateProviderDto {
  @IsEnum(PaymentProviderType)
  type!: PaymentProviderType;

  @IsString()
  @MaxLength(150)
  displayName!: string;

  @IsOptional()
  @IsEnum(PaymentEnvironmentMode)
  environment?: PaymentEnvironmentMode;

  @IsOptional()
  @IsObject()
  config?: Prisma.InputJsonValue;
}
