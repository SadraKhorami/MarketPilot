import { Injectable, BadRequestException } from "@nestjs/common";
import { Workbook } from "exceljs";
import { z } from "zod";
import { DatabaseService } from "../database.module";
import { duplicateTradeWhere, JournalTradesService } from "./journal-trades.service";

// Reject oversized expanded workbooks before ExcelJS allocates their XML contents.
function boundedWorkbook(buffer: Buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new BadRequestException("Use an ordinary .xlsx workbook.");
  const count = buffer.readUInt16LE(end + 10);
  let pos = buffer.readUInt32LE(end + 16);
  let size = 0;
  if (count > 200) throw new BadRequestException("Workbook has too many embedded entries.");
  for (let i = 0; i < count; i++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50)
      throw new BadRequestException("Invalid workbook archive.");
    size += buffer.readUInt32LE(pos + 24);
    if (size > 10 * 1024 * 1024) throw new BadRequestException("Expanded workbook must be under 10 MB.");
    pos += 46 + buffer.readUInt16LE(pos + 28) + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
  }
}
const records = z
  .array(z.record(z.string().max(80), z.unknown()))
  .min(1)
  .max(200);
@Injectable()
export class JournalImportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trades: JournalTradesService,
  ) {}
  async file(file?: { buffer: Buffer; originalname: string }) {
    if (!file || file.buffer.length > 2 * 1024 * 1024)
      throw new BadRequestException("Choose a JSON or .xlsx file up to 2 MB.");
    let rows: unknown;
    try {
      if (file.originalname.toLowerCase().endsWith(".json")) rows = JSON.parse(file.buffer.toString("utf8"));
      else if (file.originalname.toLowerCase().endsWith(".xlsx")) {
        boundedWorkbook(file.buffer);
        const workbook = new Workbook();
        await workbook.xlsx.load(new Uint8Array(file.buffer).buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount > 201 || sheet.columnCount > 30)
          throw new BadRequestException("Use the first worksheet with up to 200 trades and 30 columns.");
        const headers = Array.from({ length: sheet.columnCount }, (_, i) =>
          sheet
            .getRow(1)
            .getCell(i + 1)
            .text.trim(),
        );
        if (headers.some((h) => !h || h.length > 80) || new Set(headers).size !== headers.length)
          throw new BadRequestException("The first row needs unique column names.");
        const result: Record<string, unknown>[] = [];
        sheet.eachRow((row, index) => {
          if (index === 1) return;
          const item: Record<string, unknown> = Object.create(null);
          headers.forEach((header, i) => {
            const cell = row.getCell(i + 1);
            const value = cell.value;
            if (value instanceof Date) item[header] = value.toISOString().slice(0, -1);
            else if (
              value === null ||
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
            )
              item[header] = value;
            else throw new BadRequestException("Use plain values, not formulas or embedded objects.");
          });
          result.push(item);
        });
        rows = result;
      } else throw new BadRequestException("Supported formats: .xlsx and JSON arrays.");
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("The file could not be read. Check its format.");
    }
    const parsed = records.safeParse(rows);
    if (!parsed.success) throw new BadRequestException("Use an array of up to 200 trade objects.");
    if (JSON.stringify(parsed.data).length > 90_000)
      throw new BadRequestException("Trade data must fit within 90 KB. Split the file into smaller batches.");
    return { rows: parsed.data, columns: [...new Set(parsed.data.flatMap((row) => Object.keys(row)))] };
  }
  async preview(userId: string, input: unknown) {
    const rows = z.array(z.unknown()).min(1).max(200).safeParse(input);
    if (!rows.success) throw new BadRequestException("Choose up to 200 rows.");
    const seen = new Set<string>();
    return Promise.all(
      rows.data.map(async (row, index) => {
        try {
          const trade = this.trades.parse(row);
          const key = this.trades.importKey(trade);
          const repeated = seen.has(key);
          seen.add(key);
          const duplicate =
            repeated ||
            !!(await this.db.journalEntry.findFirst({
              where: duplicateTradeWhere(userId, trade, key),
              select: { id: true },
            }));
          return { row: index + 1, trade, duplicate, error: null };
        } catch (error) {
          return {
            row: index + 1,
            trade: null,
            duplicate: false,
            error: error instanceof Error ? error.message : "Invalid row",
          };
        }
      }),
    );
  }
  async commit(userId: string, input: unknown) {
    const body = z
      .object({ confirm: z.literal(true), rows: z.array(z.unknown()).min(1).max(200) })
      .strict()
      .safeParse(input);
    if (!body.success) throw new BadRequestException("Confirm the selected import rows.");
    const trades = body.data.rows.map((row) => this.trades.parse(row));
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        let added = 0;
        let skipped = 0;
        for (const trade of trades) {
          const key = this.trades.importKey(trade);
          const prior = await tx.journalEntry.findFirst({
            where: duplicateTradeWhere(userId, trade, key),
            select: { id: true },
          });
          if (prior) {
            skipped++;
            continue;
          }
          await this.trades.createIn(tx, userId, trade, "import", key);
          added++;
        }
        return { added, skipped };
      },
      { timeout: 20_000 },
    );
  }
}
