import { IsOptional, IsString, MaxLength, MinLength, Matches } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers, and hyphens only" })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
