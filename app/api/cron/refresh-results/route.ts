import { bearerMatches } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { refreshSite } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerMatches(secret, request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const outcome = await refreshSite(db);
  return Response.json({ ok: true, refreshed: outcome.refreshed, error: outcome.error ?? null });
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
