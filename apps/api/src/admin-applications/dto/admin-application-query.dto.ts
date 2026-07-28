import { IsOptional, IsString, MaxLength } from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class AdminApplicationQueryDto extends CursorQueryDto {
  /** Matches against application `name`/`slug` (case-insensitive, substring). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
