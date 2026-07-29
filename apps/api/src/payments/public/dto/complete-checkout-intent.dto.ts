import { IsUUID } from "class-validator";

export class CompleteCheckoutIntentDto {
  @IsUUID()
  providerId!: string;
}
