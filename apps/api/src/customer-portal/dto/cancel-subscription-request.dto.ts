import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CancelSubscriptionRequestDto {
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
