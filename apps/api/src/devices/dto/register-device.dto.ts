import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { DevicePlatform } from "@prisma/client";

export class RegisterDeviceDto {
  /** Stable client-generated device identifier - unique per application, not globally. */
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  deviceId!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** When set and the License has a deviceLimit, registering a *new* device enforces it. */
  @IsOptional()
  @IsUUID()
  licenseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  osVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  pushToken?: string;
}
