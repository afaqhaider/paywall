import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { AnnouncementType } from "@prisma/client";

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
