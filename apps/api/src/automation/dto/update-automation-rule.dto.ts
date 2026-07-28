import { PlatformEventType } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PlatformEventType)
  triggerEventType?: PlatformEventType;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  actions?: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
