import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PlatformEventsService } from "./platform-events.service";
import { ListPlatformEventsQueryDto } from "./dto/list-platform-events-query.dto";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

/** Platform-wide Event History: search/filter/timeline over every event the bus has ever published. */
@UseGuards(PlatformAdminGuard)
@Controller("admin/events")
export class PlatformEventsController {
  constructor(private readonly platformEventsService: PlatformEventsService) {}

  @Get()
  async list(@Query() query: ListPlatformEventsQueryDto) {
    return this.platformEventsService.list(query);
  }

  @Get(":eventId")
  async getOne(@Param("eventId") eventId: string) {
    return this.platformEventsService.getOne(eventId);
  }
}
