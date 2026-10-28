import { readSiteCrowd } from "@/lib/board-cache";
import { presentCrowd } from "@/lib/crowd";
import { getDb } from "@/lib/db";
import { listParties } from "@/lib/game";
import { publicCacheHeaders } from "@/lib/http-cache";
import { ensureFreshSite } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  await ensureFreshSite(db);
  const [report, parties] = await Promise.all([readSiteCrowd(db), listParties(db)]);
  const view = presentCrowd(
    report,
    parties.map((party) => ({ id: party.id, name: party.name, ballot: party.ballot, color: party.color })),
  );
  return Response.json(view, { headers: publicCacheHeaders() });
}
