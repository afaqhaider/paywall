import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { BackgroundJobsService } from "./background-jobs.service";
import { ListJobsQueryDto } from "./dto/list-jobs-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/**
 * Platform-wide worker/queue administration - not org-scoped, since jobs
 * and queues are shared infrastructure. Gated by the platform admin guard
 * (see its own doc comment re: the multi-copy situation from Phase 9).
 */
@UseGuards(PlatformAdminGuard)
@Controller("admin/jobs")
export class BackgroundJobsController {
  constructor(private readonly jobsService: BackgroundJobsService) {}

  @Get()
  async list(@Query() query: ListJobsQueryDto) {
    return this.jobsService.list(query);
  }

  @Get("queues")
  async listQueues() {
    return this.jobsService.listQueues();
  }

  @Post("queues/:queueName/pause")
  @HttpCode(HttpStatus.OK)
  async pauseQueue(
    @Param("queueName") queueName: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobsService.pauseQueue(queueName, user.id, extractRequestMeta(req));
  }

  @Post("queues/:queueName/resume")
  @HttpCode(HttpStatus.OK)
  async resumeQueue(
    @Param("queueName") queueName: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobsService.resumeQueue(queueName, user.id, extractRequestMeta(req));
  }

  @Get(":jobId")
  async getOne(@Param("jobId") jobId: string) {
    return this.jobsService.getOne(jobId);
  }

  @Post(":jobId/retry")
  @HttpCode(HttpStatus.OK)
  async retry(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobsService.retry(jobId, user.id, extractRequestMeta(req));
  }

  @Post(":jobId/cancel")
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobsService.cancel(jobId, user.id, extractRequestMeta(req));
  }
}
