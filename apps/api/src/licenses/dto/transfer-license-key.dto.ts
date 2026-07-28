import { IsUUID } from "class-validator";

export class TransferLicenseKeyDto {
  /** The License this key should now belong to. See the design-decision
   * comment on `LicenseKeysService.transfer` for why "transfer" moves the
   * key's owning License rather than merely recording a timestamp. */
  @IsUUID()
  targetLicenseId!: string;
}
