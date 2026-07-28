import { IsEnum, IsObject, IsOptional, IsUUID } from "class-validator";
import { FinancialEventType, type Prisma } from "@prisma/client";

export class CreateFinancialEventDto {
  @IsEnum(FinancialEventType)
  type!: FinancialEventType;

  @IsObject()
  payload!: Prisma.InputJsonValue;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;
}
