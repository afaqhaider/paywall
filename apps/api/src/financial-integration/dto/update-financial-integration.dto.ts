import { IsEnum } from "class-validator";
import { FinancialProviderType } from "@prisma/client";

export class UpdateFinancialIntegrationDto {
  @IsEnum(FinancialProviderType)
  provider!: FinancialProviderType;
}
