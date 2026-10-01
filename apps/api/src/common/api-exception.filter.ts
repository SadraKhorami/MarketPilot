import { randomUUID } from "node:crypto";
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId?: string }>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const requestId = request.requestId ?? randomUUID();
    const extracted =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as { error?: unknown }).error
        : undefined;
    const validation =
      typeof payload === "object" && payload !== null && "message" in payload
        ? (payload as { message?: unknown }).message
        : undefined;
    let code = status >= 500 ? "INTERNAL_ERROR" : `HTTP_${status}`;
    let message = status >= 500 ? "An unexpected error occurred." : "The request could not be completed.";
    if (typeof extracted === "object" && extracted !== null && "code" in extracted && "message" in extracted) {
      code = String((extracted as { code: unknown }).code);
      message = String((extracted as { message: unknown }).message);
    } else if (Array.isArray(validation)) {
      code = "VALIDATION_ERROR";
      message = validation.join("; ");
    } else if (typeof validation === "string" && status < 500) {
      message = validation;
    }
    const retryAfterSeconds =
      status === HttpStatus.TOO_MANY_REQUESTS &&
      typeof extracted === "object" &&
      extracted !== null &&
      "retryAfterSeconds" in extracted &&
      typeof extracted.retryAfterSeconds === "number" &&
      Number.isInteger(extracted.retryAfterSeconds) &&
      extracted.retryAfterSeconds > 0
        ? extracted.retryAfterSeconds
        : undefined;
    response
      .status(status)
      .json({ error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }, requestId });
  }
}
