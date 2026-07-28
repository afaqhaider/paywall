import { IsString, MaxLength } from "class-validator";

export class CreateRedirectUriDto {
  @IsString()
  @MaxLength(2000)
  uri!: string;
}
