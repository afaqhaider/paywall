import { ImpersonationTargetRole } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class ImpersonateDto {
  @IsEnum(ImpersonationTargetRole)
  targetRole!: ImpersonationTargetRole;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
