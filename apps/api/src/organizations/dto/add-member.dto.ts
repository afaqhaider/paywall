import { IsEmail, IsEnum } from "class-validator";
import { OrganizationRole } from "@prisma/client";

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
