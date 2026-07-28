import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { MutationOptionsDto } from "./mutation-options.dto";

export class CancelSubscriptionDto extends MutationOptionsDto {
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
