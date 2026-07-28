import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateRefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
