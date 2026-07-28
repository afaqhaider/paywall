import { IsDefined } from "class-validator";
import type { Prisma } from "@prisma/client";

/** `PlatformSetting.value` is deliberately generic JSON - branding is an
 * object, supported currencies is an array of strings, maintenance mode is
 * an object with a boolean + message, etc - so this only requires that a
 * value be present, not any particular shape. */
export class UpsertPlatformSettingDto {
  @IsDefined()
  value!: Prisma.InputJsonValue;
}
