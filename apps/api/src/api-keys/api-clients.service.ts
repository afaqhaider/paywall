import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateApiClientDto } from "./dto/create-api-client.dto";
import type { UpdateApiClientDto } from "./dto/update-api-client.dto";

/**
 * CRUD for APIClient - the named integration/consumer that owns one or more
 * APIKeys. There is no AuditAction for APIClient create/update/delete (only
 * API_KEY_* actions exist in the schema's enum), so these mutations are
 * intentionally not audit-logged; key issuance/revocation/rotation - the
 * security-relevant events - are.
 */
@Injectable()
export class ApiClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateApiClientDto) {
    if (dto.applicationId) {
      await this.assertApplicationInOrg(organizationId, dto.applicationId);
    }

    return this.prisma.aPIClient.create({
      data: {
        organizationId,
        applicationId: dto.applicationId,
        name: dto.name,
        description: dto.description,
        createdById: userId,
      },
    });
  }

  async list(organizationId: string) {
    return this.prisma.aPIClient.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(organizationId: string, apiClientId: string) {
    const client = await this.prisma.aPIClient.findUnique({ where: { id: apiClientId } });
    if (!client || client.organizationId !== organizationId) {
      throw new NotFoundException("API client not found");
    }
    return client;
  }

  async update(organizationId: string, apiClientId: string, dto: UpdateApiClientDto) {
    await this.getOne(organizationId, apiClientId);
    return this.prisma.aPIClient.update({
      where: { id: apiClientId },
      data: { name: dto.name, description: dto.description },
    });
  }

  async remove(organizationId: string, apiClientId: string): Promise<void> {
    await this.getOne(organizationId, apiClientId);
    // Cascades to APIKey/APIKeyScope rows (onDelete: Cascade in schema).
    await this.prisma.aPIClient.delete({ where: { id: apiClientId } });
  }

  private async assertApplicationInOrg(organizationId: string, applicationId: string) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application || application.organizationId !== organizationId) {
      throw new NotFoundException("Application not found for this organization");
    }
  }
}
