import { IsString, MaxLength, MinLength } from "class-validator";

export class AddApiKeyScopeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  scope!: string;
}
