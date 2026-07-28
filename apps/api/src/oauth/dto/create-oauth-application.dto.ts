import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateOAuthApplicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;
}
