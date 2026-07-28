import { Module } from "@nestjs/common";
import { InvitationsController } from "./invitations.controller";
import { InvitationAcceptanceController } from "./invitation-acceptance.controller";
import { InvitationsService } from "./invitations.service";

@Module({
  controllers: [InvitationsController, InvitationAcceptanceController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
