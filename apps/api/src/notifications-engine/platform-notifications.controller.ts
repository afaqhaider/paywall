import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PlatformNotificationsService } from "./platform-notifications.service";
import { SendNotificationDto } from "./dto/send-notification.dto";
import { ListPlatformNotificationsQueryDto } from "./dto/list-platform-notifications-query.dto";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/notifications")
export class PlatformNotificationsController {
  constructor(private readonly notificationsService: PlatformNotificationsService) {}

  @Get()
  async list(@Query() query: ListPlatformNotificationsQueryDto) {
    return this.notificationsService.list(query);
  }

  @Get(":notificationId")
  async getOne(@Param("notificationId") notificationId: string) {
    return this.notificationsService.getOne(notificationId);
  }

  @Post()
  async send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.send(dto);
  }
}
