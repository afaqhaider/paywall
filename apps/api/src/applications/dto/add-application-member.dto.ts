import { IsEmail, IsEnum } from "class-validator";
import { ApplicationMemberRole } from "@prisma/client";

export class AddApplicationMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(ApplicationMemberRole)
  role!: ApplicationMemberRole;
}
