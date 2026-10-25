import { getDb } from "@/lib/db";
import { getGroupByCode, getPublicState } from "@/lib/game";
import { ensureFreshResults } from "@/lib/refresh";
import { readToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "private, no-store" } });
  }
  await ensureFreshResults(db, group.id);
  const token = await readToken(group.id);
  const state = await getPublicState(db, group.id, token);
  return Response.json(state, { headers: { "cache-control": "private, no-store" } });
}
