import { IsDateString } from "class-validator";

export class AdjustRenewalDateDto {
  @IsDateString()
  currentPeriodEnd!: string;
}
