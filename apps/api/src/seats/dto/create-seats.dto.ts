import { IsInt, Max, Min } from "class-validator";

export class CreateSeatsDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  count!: number;
}
