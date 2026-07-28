import { IsIn, IsOptional } from "class-validator";

export class RotateApiKeyDto {
  @IsOptional()
  @IsIn(["live", "test"])
  environment?: "live" | "test";
}
