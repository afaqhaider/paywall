import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ApiKeyGuard, type ApiKeyAuthenticatedRequest } from "../../common/guards/api-key.guard";
import { Public } from "../../common/decorators/public.decorator";
import { extractRequestMeta } from "../../common/utils/request-meta.util";
import { PublicCheckoutService } from "./public-checkout.service";
import { CreateCheckoutIntentDto } from "./dto/create-checkout-intent.dto";
import { CompleteCheckoutIntentDto } from "./dto/complete-checkout-intent.dto";

/** `POST /` is called by the third-party app (API key). `GET /:id` and
 * `POST /:id/complete` are called by the end customer's browser on the
 * hosted checkout page - no API key, since the customer's device has no
 * business holding one; the intent id itself is the (short-lived,
 * single-use) capability. */
@Controller("checkout-intents")
export class PublicCheckoutIntentsController {
  constructor(private readonly publicCheckoutService: PublicCheckoutService) {}

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post()
  async create(@Body() dto: CreateCheckoutIntentDto, @Req() req: ApiKeyAuthenticatedRequest) {
    const intent = await this.publicCheckoutService.createIntent(req.apiKeyContext, dto);
    return { id: intent.id, expiresAt: intent.expiresAt };
  }

  @Public()
  @Get(":intentId")
  async getOne(@Param("intentId") intentId: string) {
    return this.publicCheckoutService.getIntent(intentId);
  }

  @Public()
  @Post(":intentId/complete")
  async complete(
    @Param("intentId") intentId: string,
    @Body() dto: CompleteCheckoutIntentDto,
    @Req() req: Request,
  ) {
    return this.publicCheckoutService.completeIntent(
      intentId,
      dto.providerId,
      extractRequestMeta(req),
    );
  }
}
