import { IsOptional, IsString, MaxLength } from "class-validator";
import { MutationOptionsDto } from "./mutation-options.dto";

export class SuspendSubscriptionDto extends MutationOptionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
