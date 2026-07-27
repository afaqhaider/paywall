import { IsDefined } from "class-validator";
import type { Prisma } from "@prisma/client";

export class UpsertApplicationSettingDto {
  @IsDefined()
  value!: Prisma.InputJsonValue;
}
