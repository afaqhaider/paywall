import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";
import { SubscriptionChangeType } from "@prisma/client";
import { MutationOptionsDto } from "./mutation-options.dto";

export class CreateSubscriptionChangeDto extends MutationOptionsDto {
  @IsEnum(SubscriptionChangeType)
  type!: SubscriptionChangeType;

  @IsOptional()
  @IsUUID()
  targetPlanId?: string;

  @IsOptional()
  @IsUUID()
  targetPriceId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetQuantity?: number;

  /**
   * true = apply now (with proration); false/omitted = schedule for the
   * next renewal (`Subscription.currentPeriodEnd`), the common case for
   * downgrades/seat-reductions/interval switches.
   */
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}
