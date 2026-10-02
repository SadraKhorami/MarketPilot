import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser } from "../common/auth";

import { AiSessionGuard } from "../ai/ai-session.guard";
import { JournalQueryDto, JournalUpdateDto, SaveJournalDto } from "./journal.dto";
import { JournalService } from "./journal.service";
@ApiTags("Journal")
@ApiSessionAuth()
@ApiStandardResponses()
@UseGuards(AiSessionGuard)
@Controller("journal")
export class JournalController {
  constructor(private readonly journal: JournalService) {}
  @Get("preferences") async preferences(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.journal.preferences(user.id) };
  }
  @Patch("preferences") async setPreferences(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return { data: await this.journal.setPreferences(user.id, body) };
  }
  @Get() async list(@CurrentUser() user: AuthenticatedUser, @Query() query: JournalQueryDto) {
    return { data: await this.journal.list(user.id, query, query.symbol) };
  }
  @Post() async save(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveJournalDto) {
    return { data: await this.journal.save(user.id, body.runId) };
  }
  @Get(":id") async detail(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return { data: await this.journal.detail(user.id, id) };
  }
  @Patch(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: JournalUpdateDto,
  ) {
    return { data: await this.journal.update(user.id, id, body) };
  }
  @Post(":id/review/:eventId") async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return { data: await this.journal.review(user.id, id, eventId) };
  }
}
