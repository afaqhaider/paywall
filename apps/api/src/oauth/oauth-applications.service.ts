import { Injectable, NotFoundException } from "@nestjs/common";
import type { CallbackURL, OAuthCredential, RedirectURI } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { generateOAuthCredential } from "./oauth-credential.util";
import type { CreateOAuthApplicationDto } from "./dto/create-oauth-application.dto";

type OAuthApplicationWithRelations = {
  id: string;
  applicationId: string;
  name: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  credentials: OAuthCredential[];
  redirectUris: RedirectURI[];
  callbackUrls: CallbackURL[];
};

/** Strips `encryptedValue`/`iv`/`authTag` - the only fields never allowed to cross a controller boundary. */
function toSafeCredential(credential: OAuthCredential) {
  const { encryptedValue: _encryptedValue, iv: _iv, authTag: _authTag, ...safe } = credential;
  return safe;
}

function toSafeOAuthApplication(oauthApplication: OAuthApplicationWithRelations) {
  return {
    ...oauthApplication,
    credentials: oauthApplication.credentials.map(toSafeCredential),
  };
}

const INCLUDE_RELATIONS = {
  credentials: true,
  redirectUris: true,
  callbackUrls: true,
} as const;

@Injectable()
export class OAuthApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    applicationId: string,
    dto: CreateOAuthApplicationDto,
    userId: string,
    meta: RequestMeta,
  ) {
    const generated = generateOAuthCredential();

    const oauthApplication = await this.prisma.oAuthApplication.create({
      data: {
        applicationId,
        name: dto.name,
        createdById: userId,
        credentials: {
          create: {
            clientId: generated.clientId,
            encryptedValue: generated.encryptedValue,
            iv: generated.iv,
            authTag: generated.authTag,
            lastFour: generated.lastFour,
          },
        },
      },
      include: INCLUDE_RELATIONS,
    });

    await this.auditService.record({
      action: "OAUTH_APPLICATION_CREATED",
      userId,
      applicationId,
      metadata: { oauthApplicationId: oauthApplication.id, name: oauthApplication.name },
      ...meta,
    });

    return {
      ...toSafeOAuthApplication(oauthApplication),
      clientId: generated.clientId,
      clientSecret: generated.plainText,
    };
  }

  async list(applicationId: string) {
    const oauthApplications = await this.prisma.oAuthApplication.findMany({
      where: { applicationId },
      include: INCLUDE_RELATIONS,
      orderBy: { createdAt: "desc" },
    });

    return oauthApplications.map(toSafeOAuthApplication);
  }

  async getOne(applicationId: string, oauthApplicationId: string) {
    const oauthApplication = await this.getOwned(applicationId, oauthApplicationId);
    return toSafeOAuthApplication(oauthApplication);
  }

  async remove(
    applicationId: string,
    oauthApplicationId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    await this.getOwned(applicationId, oauthApplicationId);

    // Credentials/redirect URIs/callback URLs cascade via the Prisma schema's onDelete: Cascade.
    await this.prisma.oAuthApplication.delete({ where: { id: oauthApplicationId } });

    await this.auditService.record({
      action: "OAUTH_APPLICATION_DELETED",
      userId,
      applicationId,
      metadata: { oauthApplicationId },
      ...meta,
    });
  }

  private async getOwned(
    applicationId: string,
    oauthApplicationId: string,
  ): Promise<OAuthApplicationWithRelations> {
    const oauthApplication = await this.prisma.oAuthApplication.findUnique({
      where: { id: oauthApplicationId },
      include: INCLUDE_RELATIONS,
    });
    if (!oauthApplication || oauthApplication.applicationId !== applicationId) {
      throw new NotFoundException("OAuth application not found");
    }
    return oauthApplication;
  }
}
