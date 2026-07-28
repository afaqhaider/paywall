import { IsString, MaxLength, MinLength } from "class-validator";

export class AddChangelogDto {
  @IsString()
  @MaxLength(50)
  version!: string;

  @IsString()
  @MinLength(1)
  notes!: string;
}
