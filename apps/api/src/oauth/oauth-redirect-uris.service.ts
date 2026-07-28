import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateRedirectUriDto } from "./dto/create-redirect-uri.dto";

/** Must parse as an absolute URL - lenient on scheme (https:// in production, http://localhost in dev). */
function assertValidRedirectUri(uri: string): void {
  try {
    const parsed = new URL(uri);
    void parsed;
  } catch {
    throw new BadRequestException("uri must be a valid absolute URL");
  }
}

@Injectable()
export class OAuthRedirectUrisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    oauthApplicationId: string,
    dto: CreateRedirectUriDto,
    userId: string,
    meta: RequestMeta,
  ) {
    assertValidRedirectUri(dto.uri);
    const oauthApplication = await this.getOwningApplication(oauthApplicationId);

    const redirectUri = await this.prisma.redirectURI.create({
      data: { oauthApplicationId, uri: dto.uri },
    });

    await this.auditService.record({
      action: "REDIRECT_URI_ADDED",
      userId,
      applicationId: oauthApplication.applicationId,
      metadata: { oauthApplicationId, redirectUriId: redirectUri.id, uri: redirectUri.uri },
      ...meta,
    });

    return redirectUri;
  }

  async remove(
    oauthApplicationId: string,
    redirectUriId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    const oauthApplication = await this.getOwningApplication(oauthApplicationId);
    const existing = await this.prisma.redirectURI.findUnique({ where: { id: redirectUriId } });
    if (!existing || existing.oauthApplicationId !== oauthApplicationId) {
      throw new NotFoundException("Redirect URI not found");
    }

    await this.prisma.redirectURI.delete({ where: { id: redirectUriId } });

    await this.auditService.record({
      action: "REDIRECT_URI_REMOVED",
      userId,
      applicationId: oauthApplication.applicationId,
      metadata: { oauthApplicationId, redirectUriId },
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
