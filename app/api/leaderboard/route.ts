import { getDb } from "@/lib/db";
import { globalLeaderboard } from "@/lib/leaderboard";
import { ensureFreshSite } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const metric = url.searchParams.get("metric") || "euclidean";
  const db = await getDb();
  await ensureFreshSite(db);
  const board = await globalLeaderboard(db, { page, metric, pageSize: 40 });
  return Response.json(board, {
    headers: { "cache-control": "public, max-age=15" },
  });
}
