import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateAllowedOriginDto {
  @IsString()
  @MaxLength(500)
  origin!: string;

  @IsOptional()
  @IsUUID()
  environmentId?: string;
}
