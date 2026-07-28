import { IsEnum, IsOptional } from "class-validator";
import { AnnouncementType } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export class ListAnnouncementsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;
}
