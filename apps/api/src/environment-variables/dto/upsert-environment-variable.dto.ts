import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertEnvironmentVariableDto {
  @IsString()
  @MaxLength(10_000)
  value!: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}
