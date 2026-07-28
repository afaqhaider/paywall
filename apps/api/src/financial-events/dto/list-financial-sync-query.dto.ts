import { IsEnum, IsOptional } from "class-validator";
import { SyncStatus } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListFinancialSyncQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(SyncStatus)
  status?: SyncStatus;
}
