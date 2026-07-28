import { IsIn, IsOptional, IsString } from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

export const STORE_SORT_VALUES = ["featured", "recent", "popular", "top_rated", "newest"] as const;
export type StoreSort = (typeof STORE_SORT_VALUES)[number];

export class BrowseStoreQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsIn(STORE_SORT_VALUES)
  sort?: StoreSort;
}

export class SearchStoreQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @IsIn(["application", "developer", "organization", "category", "feature", "tag"])
  by?: string;
}
