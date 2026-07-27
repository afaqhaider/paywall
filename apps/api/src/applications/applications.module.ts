import { Module } from "@nestjs/common";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";
import { ApplicationVersionsController } from "./application-versions.controller";
import { ApplicationVersionsService } from "./application-versions.service";
import { ApplicationEnvironmentsController } from "./application-environments.controller";
import { ApplicationEnvironmentsService } from "./application-environments.service";
import { ApplicationSecretsController } from "./application-secrets.controller";
import { ApplicationSecretsService } from "./application-secrets.service";
import { ApplicationDomainsController } from "./application-domains.controller";
import { ApplicationDomainsService } from "./application-domains.service";
import { ApplicationSettingsController } from "./application-settings.controller";
import { ApplicationSettingsService } from "./application-settings.service";
import { ApplicationMembersController } from "./application-members.controller";
import { ApplicationMembersService } from "./application-members.service";

@Module({
  controllers: [
    ApplicationsController,
    ApplicationVersionsController,
    ApplicationEnvironmentsController,
    ApplicationSecretsController,
    ApplicationDomainsController,
    ApplicationSettingsController,
    ApplicationMembersController,
  ],
  providers: [
    ApplicationsService,
    ApplicationVersionsService,
    ApplicationEnvironmentsService,
    ApplicationSecretsService,
    ApplicationDomainsService,
    ApplicationSettingsService,
    ApplicationMembersService,
  ],
})
export class ApplicationsModule {}
