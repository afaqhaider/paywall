import { IsEnum, IsOptional, IsString } from "class-validator";
import { WebhookDeliveryStatus } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListWebhookDeliveriesQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;

  @IsOptional()
  @IsString()
  eventType?: string;
}
