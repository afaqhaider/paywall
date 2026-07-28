import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateCallbackUrlDto } from "./dto/create-callback-url.dto";

/** Custom schemes are allowed (e.g. `myapp://callback`) - just require a non-empty `scheme://` value. */
function assertValidCallbackUrl(url: string): void {
  if (!url || !url.includes("://") || url.startsWith("://")) {
    throw new BadRequestException("url must include a scheme, e.g. myapp://callback");
  }
}

@Injectable()
export class OAuthCallbackUrlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    oauthApplicationId: string,
    dto: CreateCallbackUrlDto,
    userId: string,
    meta: RequestMeta,
  ) {
    assertValidCallbackUrl(dto.url);
    const oauthApplication = await this.getOwningApplication(oauthApplicationId);

    const callbackUrl = await this.prisma.callbackURL.create({
      data: { oauthApplicationId, url: dto.url },
    });

    await this.auditService.record({
      action: "CALLBACK_URL_ADDED",
      userId,
      applicationId: oauthApplication.applicationId,
      metadata: { oauthApplicationId, callbackUrlId: callbackUrl.id, url: callbackUrl.url },
      ...meta,
    });

    return callbackUrl;
  }

  async remove(
    oauthApplicationId: string,
    callbackUrlId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    const oauthApplication = await this.getOwningApplication(oauthApplicationId);
    const existing = await this.prisma.callbackURL.findUnique({ where: { id: callbackUrlId } });
    if (!existing || existing.oauthApplicationId !== oauthApplicationId) {
      throw new NotFoundException("Callback URL not found");
    }

    await this.prisma.callbackURL.delete({ where: { id: callbackUrlId } });

    await this.auditService.record({
      action: "CALLBACK_URL_REMOVED",
      userId,
      applicationId: oauthApplication.applicationId,
      metadata: { oauthApplicationId, callbackUrlId },
      ...meta,
    });
  }

  private async getOwningApplication(oauthApplicationId: string) {
    const oauthApplication = await this.prisma.oAuthApplication.findUnique({
      where: { id: oauthApplicationId },
      select: { applicationId: true },
    });
    if (!oauthApplication) {
      throw new NotFoundException("OAuth application not found");
    }
    return oauthApplication;
  }
}
