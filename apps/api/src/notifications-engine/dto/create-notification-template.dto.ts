import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { NotificationCategory, NotificationChannel } from "@prisma/client";

export class CreateNotificationTemplateDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  bodyTemplate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
