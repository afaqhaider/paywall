import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, ValidateNested } from "class-validator";
import { ERPResourceType } from "@prisma/client";

export class ErpPermissionDto {
  @IsEnum(ERPResourceType)
  resource!: ERPResourceType;

  @IsBoolean()
  canRead!: boolean;

  @IsBoolean()
  canWrite!: boolean;
}

export class UpdateErpPermissionsDto {
  @IsArray()
  @ArrayMaxSize(Object.keys(ERPResourceType).length)
  @ValidateNested({ each: true })
  @Type(() => ErpPermissionDto)
  permissions!: ErpPermissionDto[];
}
