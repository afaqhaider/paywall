import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateApiClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Omit for an organization-wide client; set to scope it to one application. */
  @IsOptional()
  @IsUUID()
  applicationId?: string;
}
