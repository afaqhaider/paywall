import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ListingVisibility } from "@prisma/client";

export class UpsertListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ListingVisibility)
  visibility?: ListingVisibility;
}
