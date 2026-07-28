import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductStatus, type Product } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { slugify } from "../common/utils/slug.util";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateProductDto, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
    });
    if (!application || application.organizationId !== organizationId) {
      throw new NotFoundException("Application not found in this organization");
    }

    const slug = await this.generateUniqueSlug(dto.name);

    const product = await this.prisma.product.create({
      data: {
        organizationId,
        applicationId: dto.applicationId,
        name: dto.name,
        slug,
        description: dto.description,
        visibility: dto.visibility,
        metadata: dto.metadata,
        createdById: userId,
      },
    });

    await this.auditService.record({
      action: "PRODUCT_CREATED",
      userId,
      organizationId,
      applicationId: dto.applicationId,
      metadata: { productId: product.id },
      ...meta,
    });

    return product;
  }

  async list(organizationId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.product.findMany({
      where: cursorWhere ? { organizationId, ...cursorWhere } : { organizationId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(productId: string, organizationId: string): Promise<Product> {
    return this.getOwned(productId, organizationId);
  }

  async update(
    productId: string,
    organizationId: string,
    userId: string,
    dto: UpdateProductDto,
    meta: RequestMeta,
  ) {
    await this.getOwned(productId, organizationId);

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { ...dto },
    });

    await this.auditService.record({
      action: "PRODUCT_UPDATED",
      userId,
      organizationId,
      applicationId: product.applicationId,
      metadata: { productId },
      ...meta,
    });

    return product;
  }

  async archive(productId: string, organizationId: string, userId: string, meta: RequestMeta) {
    await this.getOwned(productId, organizationId);

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED, archivedAt: new Date() },
    });

    await this.auditService.record({
      action: "PRODUCT_ARCHIVED",
      userId,
      organizationId,
      applicationId: product.applicationId,
      metadata: { productId },
      ...meta,
    });

    return product;
  }

  async restore(productId: string, organizationId: string, userId: string, meta: RequestMeta) {
    await this.getOwned(productId, organizationId);

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.DRAFT, archivedAt: null },
    });

    await this.auditService.record({
      action: "PRODUCT_RESTORED",
      userId,
      organizationId,
      applicationId: product.applicationId,
      metadata: { productId },
      ...meta,
    });

    return product;
  }

  /** Loads a product and verifies it actually belongs to `organizationId` -
   * a mismatch 404s exactly as if the product didn't exist, the same
   * isolation guarantee ApplicationRoleGuard gives applications. */
  private async getOwned(productId: string, organizationId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.organizationId !== organizationId) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || "product";
    let candidate = base;
    let suffix = 1;

    while (await this.prisma.product.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }
}
