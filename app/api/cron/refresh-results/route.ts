import { bearerMatches } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { refreshAllGroups } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerMatches(secret, request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const results = await refreshAllGroups(db);
  return Response.json({ ok: true, results });
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
