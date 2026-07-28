import { IsEnum, IsObject, IsOptional, IsUUID } from "class-validator";
import { ReportFormat, ReportType } from "@prisma/client";

export class CreateReportRequestDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  /** Report-type-specific filters, e.g. `{ startDate, endDate }` for date-ranged reports. */
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
