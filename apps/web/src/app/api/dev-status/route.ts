import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const headers = { "Cache-Control": "no-store" };
  try {
    const source = JSON.parse(await readFile(resolve(process.cwd(), "../../.local/dev-status.json"), "utf8"));
    const statuses = new Set(["ready", "attention", "not_configured"]);
    if (typeof source.checkedAt !== "string" || !Array.isArray(source.services)) throw new Error("Invalid status");
    const services = source.services
      .filter(
        (item: { id?: unknown; label?: unknown; status?: unknown; detail?: unknown }) =>
          typeof item.id === "string" &&
          typeof item.label === "string" &&
          typeof item.detail === "string" &&
          typeof item.status === "string" &&
          statuses.has(item.status),
      )
      .map((item: { id: string; label: string; status: string; detail: string }) => ({
        id: item.id.slice(0, 40),
        label: item.label.slice(0, 80),
        status: item.status,
        detail: item.detail.slice(0, 240),
      }));
    return Response.json({ checkedAt: source.checkedAt, services }, { headers });
  } catch {
    return Response.json({ checkedAt: null, services: [] }, { headers });
  }
}
