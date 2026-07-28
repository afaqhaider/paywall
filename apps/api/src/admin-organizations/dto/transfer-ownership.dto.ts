import { IsString } from "class-validator";

export class TransferOwnershipDto {
  @IsString()
  newOwnerUserId!: string;
}
