import { IsArray, IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { NotificationCategory, NotificationChannel } from "@prisma/client";

export class SendNotificationDto {
  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  /** Free-form template variables, e.g. `{{amount}}`, plus channel-specific
   * hints like `email`/`webhookUrl` when there's no `recipientUserId` to
   * resolve those from. */
  @IsObject()
  payload!: Record<string, unknown>;

  /** If omitted, fans out to every active template matching `category`. */
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @IsOptional()
  @IsString()
  correlationId?: string;
}
