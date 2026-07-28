import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import type { Prisma } from "@prisma/client";
import { ApplicationEnvironmentType, SubscriptionProvider } from "@prisma/client";
import { MutationOptionsDto } from "./mutation-options.dto";

export class CreateSubscriptionDto extends MutationOptionsDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  productId!: string;

  @IsUUID()
  planId!: string;

  @IsUUID()
  priceId!: string;

  @IsOptional()
  @IsEnum(ApplicationEnvironmentType)
  environmentType?: ApplicationEnvironmentType;

  @IsOptional()
  @IsEnum(SubscriptionProvider)
  provider?: SubscriptionProvider;

  @IsOptional()
  @IsString()
  providerSubscriptionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  /** Start in TRIALING instead of ACTIVE, if the plan is trial-eligible. */
  @IsOptional()
  @IsBoolean()
  startTrial?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
