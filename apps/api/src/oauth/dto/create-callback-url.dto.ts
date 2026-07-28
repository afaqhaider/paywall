import { IsString, MaxLength } from "class-validator";

export class CreateCallbackUrlDto {
  @IsString()
  @MaxLength(2000)
  url!: string;
}
