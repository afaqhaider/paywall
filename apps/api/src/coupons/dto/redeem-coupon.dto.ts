import { IsOptional, IsString, IsUUID } from "class-validator";

export class RedeemCouponDto {
  @IsOptional()
  @IsUUID()
  couponId?: string;

  @IsOptional()
  @IsString()
  promotionCode?: string;
}
