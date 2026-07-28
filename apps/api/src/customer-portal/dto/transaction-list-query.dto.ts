import { IsOptional, IsString, MaxLength } from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class TransactionListQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
