import { currentUserId } from "@/auth";
import { getDb } from "@/lib/db";
import { getGroupByCode, getPublicState, isGroupAdmin } from "@/lib/game";
import { privateCacheHeaders } from "@/lib/http-cache";
import { readGroupAdminToken, readToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Private combined view. Does not fetch the elections committee. Public polls use /standings. */
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) {
    return Response.json({ error: "not_found" }, { status: 404, headers: privateCacheHeaders() });
  }
  const userId = await currentUserId();
  const token = userId ? null : await readToken(group.id);
  const admin = await isGroupAdmin(db, group.id, await readGroupAdminToken(group.id), userId);
  const state = await getPublicState(db, group.id, token, userId, admin);
  return Response.json(state, { headers: privateCacheHeaders() });
}
