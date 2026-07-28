import { IsOptional, IsString, MaxLength } from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class AdminOrganizationQueryDto extends CursorQueryDto {
  /** Matches against organization `name`/`slug` (case-insensitive, substring). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
