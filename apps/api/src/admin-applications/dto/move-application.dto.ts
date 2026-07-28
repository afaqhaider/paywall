import { IsString } from "class-validator";

export class MoveApplicationDto {
  @IsString()
  targetOrganizationId!: string;
}
