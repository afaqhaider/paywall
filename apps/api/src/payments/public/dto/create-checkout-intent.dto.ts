import { IsEmail, IsOptional, IsUrl, IsUUID } from "class-validator";

export class CreateCheckoutIntentDto {
  @IsEmail()
  customerEmail!: string;

  @IsUUID()
  planId!: string;

  @IsUUID()
  priceId!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  successUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;
}
