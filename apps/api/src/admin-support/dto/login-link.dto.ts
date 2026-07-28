import { ImpersonationTargetRole } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class LoginLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Defaults to CUSTOMER - a login link isn't necessarily "impersonating" a specific role, just a shortcut into the target's own account. */
  @IsOptional()
  @IsEnum(ImpersonationTargetRole)
  targetRole?: ImpersonationTargetRole;
}
