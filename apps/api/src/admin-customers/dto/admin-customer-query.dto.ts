import { IsOptional, IsString, MaxLength } from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class AdminCustomerQueryDto extends CursorQueryDto {
  /** Matches against `displayName`/`email` (case-insensitive, substring) across every organization/application. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
