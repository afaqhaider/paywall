import { IsUUID } from "class-validator";

export class TransferAdminLicenseDto {
  @IsUUID()
  toUserId!: string;
}
