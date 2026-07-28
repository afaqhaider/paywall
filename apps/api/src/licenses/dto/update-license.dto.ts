import { IsDateString, IsInt, IsObject, IsOptional, Min } from "class-validator";
import type { Prisma } from "@prisma/client";

/** Deliberately excludes `type` and `status` - type is immutable once issued, and
 * status is only ever changed through the dedicated `revoke` action so that a
 * status transition always produces its own audit trail. */
export class UpdateLicenseDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  seatLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  deviceLimit?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
