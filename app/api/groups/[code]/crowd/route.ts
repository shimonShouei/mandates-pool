import { readGroupCrowd } from "@/lib/board-cache";
import { presentCrowd } from "@/lib/crowd";
import { getDb } from "@/lib/db";
import { getGroupByCode, listParties } from "@/lib/game";
import { privateCacheHeaders, publicCacheHeaders } from "@/lib/http-cache";
import { ensureFreshSite } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) {
    return Response.json({ error: "not_found" }, { status: 404, headers: privateCacheHeaders() });
  }
  await ensureFreshSite(db);
  const [report, parties] = await Promise.all([readGroupCrowd(db, group.id), listParties(db)]);
  const view = presentCrowd(
    report,
    parties.map((party) => ({ id: party.id, name: party.name, ballot: party.ballot, color: party.color })),
  );
  return Response.json(view, { headers: publicCacheHeaders() });
}
