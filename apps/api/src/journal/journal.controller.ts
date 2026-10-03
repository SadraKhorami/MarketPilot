import {
  Body,
  Delete,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Headers,
} from "@nestjs/common";
import { z } from "zod";
import { BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JournalAssistantService } from "./journal-assistant.service";
import { JournalTradesService } from "./journal-trades.service";
import { JournalImportService } from "./journal-import.service";
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
  constructor(
    private readonly journal: JournalService,
    private readonly trades: JournalTradesService,
    private readonly imports: JournalImportService,
    private readonly assistant: JournalAssistantService,
  ) {}
  @Get("assistant/history") async assistantHistory(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.assistant.history(user.id) };
  }
  @Post("assistant") async askAssistant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query() query: JournalQueryDto,
  ) {
    return { data: await this.assistant.ask(user.id, body, query) };
  }
  @Post("assistant/:id/confirm") async confirmAssistant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return { data: await this.assistant.confirm(user.id, id, body) };
  }
  @Post("manual") async manual(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers("x-request-id") requestId: string,
  ) {
    return { data: await this.trades.create(user.id, body, requestId) };
  }
  @Get("currencies") async currencies(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.trades.currencies(user.id) };
  }
  @Get("analytics") async analytics(@CurrentUser() user: AuthenticatedUser, @Query() query: JournalQueryDto) {
    return { data: await this.trades.analytics(user.id, query) };
  }
  @Post("import/file")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  async file(@UploadedFile() file: { buffer: Buffer; originalname: string }) {
    return { data: await this.imports.file(file) };
  }
  @Post("import/preview") async preview(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return { data: await this.imports.preview(user.id, body) };
  }
  @Post("import/confirm") async importTrades(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return { data: await this.imports.commit(user.id, body) };
  }
  @Post(":id/note-draft") async draftNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return { data: await this.assistant.draftNote(user.id, id) };
  }
  @Post(":id/archive") async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ archived: z.boolean() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Choose archive or restore.");
    return { data: await this.trades.archive(user.id, id, parsed.data.archived) };
  }
  @Post(":id/transition") async transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({ status: z.enum(["cancelled", "expired"]), confirm: z.literal(true) })
      .strict()
      .safeParse(body);
    if (!parsed.success) throw new BadRequestException("Confirm the waiting plan update.");
    return { data: await this.trades.transition(user.id, id, parsed.data.status) };
  }
  @Post(":id/exits") async exit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return { data: await this.trades.exit(user.id, id, body) };
  }

  @Patch(":id/trade") async editTrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return { data: await this.trades.edit(user.id, id, body) };
  }
  @Delete(":id") async deleteTrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return { data: await this.trades.remove(user.id, id, body) };
  }
  @Get("preferences") async preferences(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.journal.preferences(user.id) };
  }
  @Get("preferences/state") async preferenceState(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.journal.preferenceState(user.id) };
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
