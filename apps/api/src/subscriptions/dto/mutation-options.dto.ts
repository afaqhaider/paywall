import { IsInt, IsOptional, IsString, Min } from "class-validator";

/**
 * Shared by every lifecycle mutation: `idempotencyKey` lets a caller safely
 * retry the same request (matched against SubscriptionEvent.idempotencyKey);
 * `expectedVersion` is the optimistic-concurrency check against
 * Subscription.version - a mismatch means someone else changed the
 * subscription first and the caller should refetch and retry.
 */
export class MutationOptionsDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
