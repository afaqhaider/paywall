import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { ApplicationMemberRole } from "@prisma/client";

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(ApplicationMemberRole)
  role?: ApplicationMemberRole;
}
