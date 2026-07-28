import { IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";
import type { Prisma } from "@prisma/client";

export class CreateManualTransactionDto {
  @IsUUID()
  providerId!: string;

  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsInt()
  @Min(0)
  amountMinor!: number;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
