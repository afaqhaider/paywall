import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { AuditAction } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

/**
 * Shared by both `GET /admin/audit-log` (paginated) and
 * `GET /admin/audit-log/export` (unpaginated, capped) - the export route
 * simply ignores `cursor`/`limit`.
 */
export class AdminAuditLogQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  /** ISO date/datetime - inclusive lower bound on `createdAt`. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** ISO date/datetime - inclusive upper bound on `createdAt`. */
  @IsOptional()
  @IsDateString()
  to?: string;

  /**
   * Free-text search - matched against `AuditAction` enum values
   * (case-insensitive substring), since that's the only string-shaped
   * column on AuditLog worth searching without joining every related
   * table. Anything else (org/app/user name) should use the dedicated
   * `organizationId`/`applicationId`/`userId` filters instead.
   */
  @IsOptional()
  @IsString()
  search?: string;
}
