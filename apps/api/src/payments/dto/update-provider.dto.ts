import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import type { Prisma } from "@prisma/client";
import { PaymentProviderStatus } from "@prisma/client";

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @IsOptional()
  @IsEnum(PaymentProviderStatus)
  status?: PaymentProviderStatus;

  @IsOptional()
  @IsObject()
  config?: Prisma.InputJsonValue;
}
