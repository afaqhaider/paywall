import { IsDateString } from "class-validator";

export class ExtendTrialDto {
  @IsDateString()
  newTrialEnd!: string;
}
