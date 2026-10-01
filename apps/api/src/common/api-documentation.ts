import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

class ApiErrorDetail {
  @ApiPropertyOptional({ example: 42, description: "Seconds to wait for a rate-limited request." })
  retryAfterSeconds?: number;
  @ApiProperty({ example: "VALIDATION_ERROR" }) code!: string;
  @ApiProperty({ example: "The request could not be completed." }) message!: string;
}

class ApiErrorResponse {
  @ApiProperty({ type: ApiErrorDetail }) error!: ApiErrorDetail;
  @ApiProperty({ example: "9f4b8d73-5641-48c0-9871-8ace2fd5c661" }) requestId!: string;
}

export const ApiSessionAuth = () => ApiCookieAuth("sessionCookie");
export const ApiReadAuth = () => applyDecorators(ApiSessionAuth(), ApiBearerAuth("apiKey"));

export const ApiStandardResponses = () =>
  applyDecorators(
    ApiExtraModels(ApiErrorResponse),
    ApiOkResponse({
      description: "Successful response envelope containing a data field.",
      schema: { type: "object", properties: { data: { type: "object", additionalProperties: true } } },
    }),
    ApiBadRequestResponse({ type: ApiErrorResponse, description: "Validation or invalid request error." }),
    ApiUnauthorizedResponse({ type: ApiErrorResponse, description: "Authentication is missing or invalid." }),
    ApiForbiddenResponse({
      type: ApiErrorResponse,
      description: "The authenticated user or API key lacks permission.",
    }),
    ApiNotFoundResponse({ type: ApiErrorResponse, description: "The requested user-owned resource was not found." }),
    ApiTooManyRequestsResponse({ type: ApiErrorResponse, description: "Request rate limit exceeded." }),
    ApiInternalServerErrorResponse({
      type: ApiErrorResponse,
      description: "Unexpected server error. Details are not exposed.",
    }),
  );
