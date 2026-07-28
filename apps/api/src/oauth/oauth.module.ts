import { Module } from "@nestjs/common";
import { OAuthApplicationsController } from "./oauth-applications.controller";
import { OAuthApplicationsService } from "./oauth-applications.service";
import { OAuthCredentialsController } from "./oauth-credentials.controller";
import { OAuthCredentialsService } from "./oauth-credentials.service";
import { OAuthRedirectUrisController } from "./oauth-redirect-uris.controller";
import { OAuthRedirectUrisService } from "./oauth-redirect-uris.service";
import { OAuthCallbackUrlsController } from "./oauth-callback-urls.controller";
import { OAuthCallbackUrlsService } from "./oauth-callback-urls.service";

@Module({
  controllers: [
    OAuthApplicationsController,
    OAuthCredentialsController,
    OAuthRedirectUrisController,
    OAuthCallbackUrlsController,
  ],
  providers: [
    OAuthApplicationsService,
    OAuthCredentialsService,
    OAuthRedirectUrisService,
    OAuthCallbackUrlsService,
  ],
})
export class OAuthModule {}
