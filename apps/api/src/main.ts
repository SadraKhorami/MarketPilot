import "./environment";
import "reflect-metadata";

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { API_CATALOG } from "./api-keys/api-catalog";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { RequestUsageMiddleware } from "./common/request-usage.middleware";
import { validateApiConfiguration, webOrigins } from "./common/runtime-config";
import { StructuredLogger } from "./common/structured-logger";

async function bootstrap() {
  validateApiConfiguration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    abortOnError: false,
    logger: new StructuredLogger({ json: true }),
  });
  const origins = webOrigins();
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY && process.env.TRUST_PROXY !== "false"
      ? process.env.TRUST_PROXY.split(",").map((entry) => entry.trim())
      : false,
  );

  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: [
      "X-Request-Id",
      "X-RateLimit-Limit",
      "X-RateLimit-Window",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "X-RateLimit-Mode",
      "Retry-After",
    ],
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
  app.useBodyParser("json", { limit: "128kb" });
  app.useBodyParser("urlencoded", { extended: false, limit: "128kb", parameterLimit: 100 });
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
  // Keep developer descriptions aligned with the catalog used by the key form and guide.
  for (const endpoint of API_CATALOG.endpoints) {
    const operation = document.paths[`/api/v1${endpoint.path}`]?.get;
    if (!operation) throw new Error(`Catalog endpoint is missing from OpenAPI: ${endpoint.path}`);
    operation.summary = endpoint.title;
    operation.description = `${endpoint.description} Required API-key scope: ${endpoint.scope}. Parameters: ${endpoint.parameters}. Response: ${endpoint.response}.`;
  }
  SwaggerModule.setup("api/v1/docs", app, document, {
    jsonDocumentUrl: "/api/v1/openapi.json",
    swaggerOptions: { persistAuthorization: false },
  });

  const port = Number(process.env.API_PORT ?? 4000);
  const server: Server = app.getHttpServer();
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  server.keepAliveTimeout = 5000;
  await app.listen(port, process.env.API_HOST ?? "0.0.0.0");
}

void bootstrap().catch((error: unknown) => {
  // Initialization errors may contain connection URLs. Diagnose configuration by names, never dump errors.
  const configuration =
    error instanceof Error && /^(Invalid|Missing) configuration: [A-Z_, ]+$/.test(error.message)
      ? error.message
      : undefined;
  console.error(JSON.stringify({ event: "api_start_failed", timestamp: new Date().toISOString(), configuration }));
  process.exit(1);
});
