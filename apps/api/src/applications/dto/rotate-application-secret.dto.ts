import { IsString, MaxLength, MinLength } from "class-validator";

export class RotateApplicationSecretDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  value!: string;
}
