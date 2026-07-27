import { IsBoolean, IsOptional } from "class-validator";

export class UpdateApplicationDomainDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
