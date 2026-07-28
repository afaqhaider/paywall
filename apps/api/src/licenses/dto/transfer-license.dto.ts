import { IsUUID } from "class-validator";

export class TransferLicenseDto {
  @IsUUID()
  toUserId!: string;
}
