import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class NotificationQueryDto extends CursorQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  unreadOnly?: boolean;
}
