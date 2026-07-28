import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { buildCorsOptions } from "./config/cors.config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors(buildCorsOptions(config.get<string>("WEB_ORIGIN", "http://localhost:3000")));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("SS Zentronics Platform API")
      .setDescription("Developer Portal API reference")
      .setVersion(config.get<string>("PLATFORM_VERSION", "0.1.0"))
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("api-docs", app, document);

  const port = config.get<number>("PORT", 4000);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}`, "Bootstrap");
}

void bootstrap();
