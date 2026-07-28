import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { NotificationCategory, NotificationChannel } from "@prisma/client";

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  key?: string;

  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  bodyTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
