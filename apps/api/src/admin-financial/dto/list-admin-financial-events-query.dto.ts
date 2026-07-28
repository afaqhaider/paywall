import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { FinancialEventType } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListAdminFinancialEventsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(FinancialEventType)
  type?: FinancialEventType;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
