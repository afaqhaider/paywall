import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateEntitlementDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  featureId?: string;
}
