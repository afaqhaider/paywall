import { IsInt, IsOptional, IsPositive, IsUUID } from "class-validator";

/** Body for `POST /v1/entitlements/:key/usage/increment|decrement`. */
export class AdjustUsageDto {
  /** Defaults to 1 when omitted. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  /** Required only when the calling API key isn't scoped to a single application. */
  @IsOptional()
  @IsUUID()
  applicationId?: string;
}
