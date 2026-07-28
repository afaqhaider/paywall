import { IsUUID } from "class-validator";

export class SdkConfigQueryDto {
  @IsUUID()
  environmentId!: string;
}
