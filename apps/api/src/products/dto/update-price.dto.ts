import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { PriceStatus } from "@prisma/client";

export class UpdatePriceDto {
  @IsOptional()
  @IsEnum(PriceStatus)
  status?: PriceStatus;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
