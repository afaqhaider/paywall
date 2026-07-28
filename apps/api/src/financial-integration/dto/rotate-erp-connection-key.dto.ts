import { IsString, MinLength } from "class-validator";

export class RotateErpConnectionKeyDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;
}
