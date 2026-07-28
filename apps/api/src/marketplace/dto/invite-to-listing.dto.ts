import { IsEmail } from "class-validator";

export class InviteToListingDto {
  @IsEmail()
  email!: string;
}
