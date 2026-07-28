import { IsObject, IsOptional, IsString, IsUUID, IsUrl } from "class-validator";
import type { Prisma } from "@prisma/client";

export class CreateCheckoutSessionDto {
  @IsUUID()
  providerId!: string;

  @IsUUID()
  customerId!: string;

  @IsUUID()
  priceId!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  successUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
