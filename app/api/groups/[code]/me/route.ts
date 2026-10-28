import { currentUserId } from "@/auth";
import { claimDeviceIdentity } from "@/lib/claim-device";
import { getDb } from "@/lib/db";
import { getGroupByCode, getPublicState } from "@/lib/game";
import { privateCacheHeaders } from "@/lib/http-cache";
import { readToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) {
    return Response.json({ error: "not_found" }, { status: 404, headers: privateCacheHeaders() });
  }
  await claimDeviceIdentity();
  const userId = await currentUserId();
  const token = userId ? null : await readToken(group.id);
  const state = await getPublicState(db, group.id, token, userId);
  return Response.json({ own: state.own }, { headers: privateCacheHeaders() });
}
