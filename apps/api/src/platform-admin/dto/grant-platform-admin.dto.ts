import { PlatformAdminRole } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional } from "class-validator";

export class GrantPlatformAdminDto {
  @IsEmail()
  userEmail!: string;

  @IsOptional()
  @IsEnum(PlatformAdminRole)
  role?: PlatformAdminRole;
}
