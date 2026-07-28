import { IsEnum, IsOptional, IsString } from "class-validator";
import { NotificationCategory } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListPlatformNotificationsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
