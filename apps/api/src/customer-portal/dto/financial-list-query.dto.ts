import { IsOptional, IsString, MaxLength } from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

/** Used by the invoices/receipts list endpoints - `status` is validated loosely (a free string) since its meaning differs by provider mode (INTERNAL vs LEDGIX_ERP) and is checked against the relevant enum at read time. */
export class FinancialListQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
