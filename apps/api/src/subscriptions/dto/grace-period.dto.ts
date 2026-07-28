import { IsInt, IsOptional, Min } from "class-validator";
import { MutationOptionsDto } from "./mutation-options.dto";

export class GracePeriodDto extends MutationOptionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  graceDays?: number;
}
