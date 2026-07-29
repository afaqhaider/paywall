import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiKeyGuard, type ApiKeyAuthenticatedRequest } from "../../common/guards/api-key.guard";
import { Public } from "../../common/decorators/public.decorator";
import { PublicCheckoutService } from "./public-checkout.service";

/** Called by third-party apps (the "developer embed" front) with their API
 * key - see PublicCheckoutService's class doc for the full flow. `@Public()`
 * bypasses the global JWT guard (there is no platform User JWT here at
 * all); `ApiKeyGuard` is this route's real auth check. */
@Public()
@UseGuards(ApiKeyGuard)
@Controller("public/plans")
export class PublicCatalogController {
  constructor(private readonly publicCheckoutService: PublicCheckoutService) {}

  @Get()
  async listPlans(@Req() req: ApiKeyAuthenticatedRequest) {
    return this.publicCheckoutService.listPlans(req.apiKeyContext);
  }
}
