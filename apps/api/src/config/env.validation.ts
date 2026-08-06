import { plainToInstance } from "class-transformer";
import {
  IsBase64,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  MinLength,
  validateSync,
} from "class-validator";

const APP_SECRET_ENCRYPTION_KEY_BYTES = 32;

class EnvironmentVariables {
  @IsOptional()
  @IsIn(["development", "test", "production"])
  NODE_ENV?: string;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  @MinLength(32, {
    message: "JWT_ACCESS_SECRET must be at least 32 characters long",
  })
  JWT_ACCESS_SECRET!: string;

  @IsNotEmpty()
  @IsBase64()
  APP_SECRET_ENCRYPTION_KEY!: string;

  @IsOptional()
  @IsNotEmpty()
  WEB_ORIGIN?: string;

  @IsOptional()
  @IsIn(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  LOG_LEVEL?: string;

  @IsOptional()
  @IsNumberString()
  RATE_LIMIT_TTL_MS?: string;

  @IsOptional()
  @IsNumberString()
  RATE_LIMIT_LIMIT?: string;

  @IsOptional()
  @IsNotEmpty()
  PLATFORM_VERSION?: string;

  @IsOptional()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsNotEmpty()
  GOOGLE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsNotEmpty()
  GOOGLE_CALLBACK_URL?: string;

  // Firebase provisioning (optional - this project has no Firebase project
  // yet). Leave all empty; see apps/api/src/config/secrets.ts and
  // docs/SECRETS.md. Deliberately not validated as a set (e.g. requiring
  // all-or-nothing) so partial provisioning during setup doesn't crash
  // the app - secrets.ts's `firebase.configured` gates actual use.
  @IsOptional()
  @IsNotEmpty()
  FIREBASE_PROJECT_ID?: string;

  @IsOptional()
  @IsNotEmpty()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsNotEmpty()
  FIREBASE_PRIVATE_KEY?: string;

  @IsOptional()
  @IsNotEmpty()
  FIREBASE_SECRET_MANAGER_PROJECT_ID?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {})).join("; ");
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  const keyBytes = Buffer.from(validatedConfig.APP_SECRET_ENCRYPTION_KEY, "base64").length;
  if (keyBytes !== APP_SECRET_ENCRYPTION_KEY_BYTES) {
    throw new Error(
      `Invalid environment configuration: APP_SECRET_ENCRYPTION_KEY must decode to exactly ${APP_SECRET_ENCRYPTION_KEY_BYTES} bytes (base64-encoded); got ${keyBytes}`,
    );
  }

  return validatedConfig;
}
