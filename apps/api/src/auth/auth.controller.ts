import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedRequest, type AuthenticatedUser, CurrentUser, Public } from "../common/auth";
import { SESSION_COOKIE } from "./auth.constants";
import { CredentialsDto, RegisterDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  @ApiStandardResponses()
  @ApiOperation({ summary: "Create an account and start a session" })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(body);
    this.setCookie(response, result.rawToken, result.expiresAt);
    return { data: result.user };
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiStandardResponses()
  @ApiOperation({ summary: "Sign in and start a session" })
  async login(@Body() body: CredentialsDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body);
    this.setCookie(response, result.rawToken, result.expiresAt);
    return { data: result.user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiSessionAuth()
  @ApiStandardResponses()
  @ApiOperation({ summary: "Revoke the current session" })
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    if (request.user.sessionId) await this.auth.logout(request.user.sessionId);
    response.clearCookie(SESSION_COOKIE, this.cookieOptions());
    return { data: { success: true } };
  }

  @Get("sessions")
  @ApiSessionAuth()
  @ApiStandardResponses()
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.auth.listSessions(user.id);
    return { data: sessions.map((session) => ({ ...session, current: session.id === user.sessionId })) };
  }

  @Delete("sessions/:id")
  @ApiSessionAuth()
  @ApiStandardResponses()
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!(await this.auth.revokeSession(user.id, id)))
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Session not found." } });
    if (id === user.sessionId) response.clearCookie(SESSION_COOKIE, this.cookieOptions());
    return { data: { success: true } };
  }

  @Get("me")
  @ApiSessionAuth()
  @ApiStandardResponses()
  @ApiOperation({ summary: "Get the authenticated user" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { data: user };
  }

  private setCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
  }
}
