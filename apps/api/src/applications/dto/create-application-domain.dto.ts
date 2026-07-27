import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const DOMAIN_REGEX =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export class CreateApplicationDomainDto {
  @IsString()
  @MaxLength(255)
  @Matches(DOMAIN_REGEX, { message: "Must be a valid domain name" })
  domain!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
