import { randomUUID } from "node:crypto";
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId?: string }>();
    const response = context.getResponse<Response>();
    const parserStatus =
      typeof exception === "object" &&
      exception !== null &&
      "type" in exception &&
      "status" in exception &&
      ((exception.type === "entity.too.large" && exception.status === 413) ||
        (exception.type === "entity.parse.failed" && exception.status === 400))
        ? exception.status
        : undefined;
    const status =
      exception instanceof HttpException ? exception.getStatus() : (parserStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
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
    if (parserStatus === 413) message = "The request body is too large.";
    if (parserStatus === 400) message = "The request body is invalid.";
    if (typeof extracted === "object" && extracted !== null && "code" in extracted && "message" in extracted) {
      code = String((extracted as { code: unknown }).code);
      message = String((extracted as { message: unknown }).message);
    } else if (Array.isArray(validation)) {
      code = "VALIDATION_ERROR";
      message = validation.join("; ");
    } else if (typeof validation === "string" && status < 500) {
      message = validation;
    }
    if (status >= 500) this.logger.error({ event: "request_failed", requestId, statusCode: status, code });
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
