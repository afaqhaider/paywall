import { IsOptional, IsString } from "class-validator";

/** `subject` only makes sense for `type=EMAIL`; NOTIFICATION templates are
 * body-only. Not enforced here since `type` is a route param, not part of
 * the body - the service just stores whatever's given. */
export class UpsertMessageTemplateDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;
}
