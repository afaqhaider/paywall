import { IsInt, IsOptional, Min } from "class-validator";

export class IncrementUsageDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;
}
