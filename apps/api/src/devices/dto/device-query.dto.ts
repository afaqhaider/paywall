import { IsOptional, IsUUID } from "class-validator";

export class DeviceQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  licenseId?: string;
}
