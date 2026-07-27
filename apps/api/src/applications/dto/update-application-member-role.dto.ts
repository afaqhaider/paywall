import { IsEnum } from "class-validator";
import { ApplicationMemberRole } from "@prisma/client";

export class UpdateApplicationMemberRoleDto {
  @IsEnum(ApplicationMemberRole)
  role!: ApplicationMemberRole;
}
