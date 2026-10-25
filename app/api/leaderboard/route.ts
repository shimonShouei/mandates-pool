import { getDb } from "@/lib/db";
import { publicCacheHeaders } from "@/lib/http-cache";
import { globalLeaderboard } from "@/lib/leaderboard";
import { ensureFreshSite } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const db = await getDb();
  await ensureFreshSite(db);
  const board = await globalLeaderboard(db, { page, pageSize: 40 });
  return Response.json(board, { headers: publicCacheHeaders() });
}
