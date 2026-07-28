import { IsEnum, IsOptional } from "class-validator";
import { FinancialEventType } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListFinancialEventsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(FinancialEventType)
  type?: FinancialEventType;
}
