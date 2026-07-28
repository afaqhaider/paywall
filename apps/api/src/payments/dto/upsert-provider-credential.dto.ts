import { IsString, MaxLength } from "class-validator";

export class UpsertProviderCredentialDto {
  @IsString()
  @MaxLength(100)
  key!: string;

  @IsString()
  @MaxLength(8000)
  value!: string;
}
