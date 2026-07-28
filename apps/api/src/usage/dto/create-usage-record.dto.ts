import { IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from "class-validator";
import type { Prisma } from "@prisma/client";

export class CreateUsageRecordDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsUUID()
  featureId!: string;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
