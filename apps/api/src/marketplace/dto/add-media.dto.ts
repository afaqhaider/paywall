import { IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from "class-validator";
import { MediaAssetType } from "@prisma/client";

export class AddMediaDto {
  @IsEnum(MediaAssetType)
  type!: MediaAssetType;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
