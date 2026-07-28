import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentTransactionStatus, SubscriptionStatus } from "@prisma/client";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";

/** Base query shape shared by every `admin/*` directory list endpoint. */
export class AdminListQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminSubscriptionListQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

export class AdminPaymentListQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(PaymentTransactionStatus)
  status?: PaymentTransactionStatus;
}
