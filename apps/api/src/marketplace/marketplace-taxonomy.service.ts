import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { CreateTagDto } from "./dto/create-tag.dto";

/**
 * Platform-curated marketplace taxonomy - categories and tags are shared
 * across every organization's listings, so creating them is a platform-admin
 * action; developers only ATTACH existing categories/tags to their own
 * listing (see `ListingsService.setCategories`/`setTags`).
 */
@Injectable()
export class MarketplaceTaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listCategories() {
    return this.prisma.marketplaceCategory.findMany({ orderBy: { name: "asc" } });
  }

  async createCategory(dto: CreateCategoryDto, userId: string, meta: RequestMeta) {
    const existing = await this.prisma.marketplaceCategory.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) {
      throw new ConflictException("A category with this name or slug already exists");
    }

    const category = await this.prisma.marketplaceCategory.create({ data: { ...dto } });

    await this.auditService.record({
      action: "MARKETPLACE_CATEGORY_CREATED",
      userId,
      metadata: { categoryId: category.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return category;
  }

  async listTags() {
    return this.prisma.marketplaceTag.findMany({ orderBy: { name: "asc" } });
  }

  async createTag(dto: CreateTagDto, userId: string, meta: RequestMeta) {
    const existing = await this.prisma.marketplaceTag.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) {
      throw new ConflictException("A tag with this name or slug already exists");
    }

    const tag = await this.prisma.marketplaceTag.create({ data: { ...dto } });

    await this.auditService.record({
      action: "MARKETPLACE_TAG_CREATED",
      userId,
      metadata: { tagId: tag.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tag;
  }
}
