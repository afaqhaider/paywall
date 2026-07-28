import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, type WhiteLabelConfig } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateWhiteLabelDto } from "./dto/update-white-label.dto";

@Injectable()
export class WhiteLabelService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the organization's white-label config, or `null` if one has
   * never been configured (callers should treat `null` as "use platform
   * defaults", not as an error).
   */
  async getForOrganization(organizationId: string): Promise<WhiteLabelConfig | null> {
    return this.prisma.whiteLabelConfig.findUnique({ where: { organizationId } });
  }

  async upsert(organizationId: string, dto: UpdateWhiteLabelDto): Promise<WhiteLabelConfig> {
    const fields = {
      logoUrl: dto.logoUrl,
      brandName: dto.brandName,
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      customDomain: dto.customDomain,
      emailFromName: dto.emailFromName,
      emailTemplates: dto.emailTemplates as Prisma.InputJsonValue | undefined,
      marketplaceBranding: dto.marketplaceBranding as Prisma.InputJsonValue | undefined,
    };

    try {
      return await this.prisma.whiteLabelConfig.upsert({
        where: { organizationId },
        create: { ...fields, organization: { connect: { id: organizationId } } },
        update: fields,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("customDomain is already in use by another organization");
      }
      throw error;
    }
  }
}
