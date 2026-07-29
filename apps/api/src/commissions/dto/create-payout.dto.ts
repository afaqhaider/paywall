import { IsString } from "class-validator";

export class CreatePayoutDto {
  @IsString()
  organizationId!: string;
}
