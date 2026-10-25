import { publicGroupFields, readGroupBoard } from "@/lib/board-cache";
import { getDb } from "@/lib/db";
import { getGroupByCode } from "@/lib/game";
import { privateCacheHeaders, publicCacheHeaders } from "@/lib/http-cache";
import { ensureFreshSite } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public aggregate board. A person's seat vector is never included, even when the group is open. */

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) {
    return Response.json({ error: "not_found" }, { status: 404, headers: privateCacheHeaders() });
  }
  await ensureFreshSite(db);
  const board = await readGroupBoard(db, group.id);
  return Response.json(publicGroupFields(board), { headers: publicCacheHeaders() });
}
