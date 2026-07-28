import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { ReportFormat, ReportStatus, ReportType } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListReportRequestsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
