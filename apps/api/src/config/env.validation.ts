import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  MinLength,
  validateSync,
} from "class-validator";

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

  return validatedConfig;
}
