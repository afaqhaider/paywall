import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { buildCorsOptions } from "./config/cors.config";
import { secrets } from "./config/secrets";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors(buildCorsOptions(secrets.webOrigin));
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
      .setVersion(secrets.platformVersion)
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("api-docs", app, document);

  await app.listen(secrets.port);
  logger.log(`API listening on http://localhost:${secrets.port}`, "Bootstrap");
}

void bootstrap();
