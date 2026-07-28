import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { AnnouncementType } from "@prisma/client";

export class CreateAnnouncementDto {
  @IsEnum(AnnouncementType)
  type!: AnnouncementType;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

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
