import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { PlatformEventStatus, PlatformEventType } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListPlatformEventsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(PlatformEventType)
  type?: PlatformEventType;

  @IsOptional()
  @IsEnum(PlatformEventStatus)
  status?: PlatformEventStatus;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}
