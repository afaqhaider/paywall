import { IsUUID } from "class-validator";
import { CreateLicenseDto } from "../../licenses/dto/create-license.dto";

/**
 * Same shape as `CreateLicenseDto` plus `organizationId` - the org-scoped
 * controller gets that from the route (`organizations/:organizationId/...`),
 * but this admin route isn't org-scoped, so it has to come from the body.
 */
export class CreateAdminLicenseDto extends CreateLicenseDto {
  @IsUUID()
  organizationId!: string;
}
