import { IsUUID } from "class-validator";

export class AssignLicenseDto {
  @IsUUID()
  userId!: string;
}
