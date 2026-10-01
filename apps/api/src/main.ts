import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { RequestUsageMiddleware } from "./common/request-usage.middleware";

dotenv.config({ path: "../../.env" });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const origins = (process.env.WEB_ORIGIN ?? "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim());

  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.use(
    (
      request: { headers: Record<string, string | string[] | undefined>; requestId?: string },
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      const supplied = request.headers["x-request-id"];
      request.requestId =
        typeof supplied === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(supplied) ? supplied : randomUUID();
      response.setHeader("X-Request-Id", request.requestId);
      next();
    },
  );
  const usage = app.get(RequestUsageMiddleware);
  app.use(usage.use.bind(usage));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("MarketPilot API")
    .setDescription(
      "MarketPilot's authenticated product API. Browser sessions use an HTTP-only cookie; programmatic clients may use a scoped API key as a bearer token.",
    )
    .setVersion("1.0.0")
    .addCookieAuth("marketpilot_session", { type: "apiKey", in: "cookie" }, "sessionCookie")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "MarketPilot API key" }, "apiKey")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/v1/docs", app, document, {
    jsonDocumentUrl: "/api/v1/openapi.json",
    swaggerOptions: { persistAuthorization: false },
  });

  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, process.env.API_HOST ?? "0.0.0.0");
}

void bootstrap();
