import { IsUUID } from "class-validator";

export class TransferSeatDto {
  @IsUUID()
  userId!: string;
}
