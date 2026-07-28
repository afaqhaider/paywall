import { IsString, MaxLength, MinLength, Matches } from "class-validator";

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers, and hyphens only" })
  slug!: string;
}
