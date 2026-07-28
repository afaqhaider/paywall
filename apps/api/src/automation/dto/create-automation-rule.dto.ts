import { PlatformEventType } from "@prisma/client";
import { IsArray, IsEnum, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Each entry in `actions` is a free-form action descriptor, e.g.
 * `{ "action": "SEND_NOTIFICATION", "category": "SUBSCRIPTION_RENEWED" }`.
 * Deliberately loose (mirrors the `actions Json` column comment in
 * schema.prisma) - `AutomationActionExecutorService` is the only place
 * that interprets the shape, keyed off a fixed `action` vocabulary. We
 * only validate that each entry is an object here; the rest is validated
 * defensively at execution time.
 */
export class CreateAutomationRuleDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PlatformEventType)
  triggerEventType!: PlatformEventType;

  @IsArray()
  @IsObject({ each: true })
  actions!: Record<string, unknown>[];
}
