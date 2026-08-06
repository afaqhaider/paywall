import { IsString, MaxLength, MinLength } from "class-validator";

/** Body for `POST /v1/licenses/:licenseId/seats/validate`. */
export class ValidateSeatDto {
  /** The end user's id within the calling application - opaque to this platform. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  userId!: string;
}
