import { bearerMatches } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { scheduledResultsRefresh } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const routeHeaders = { "x-results-max-duration": "60" };

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerMatches(secret, request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: routeHeaders });
  }
  try {
    const db = await getDb();
    const report = await scheduledResultsRefresh(db);
    return Response.json(report, { headers: routeHeaders });
  } catch {
    return Response.json(
      {
        updated: false,
        reason: "fetch-failed",
        source: null,
        percentCounted: null,
        isFinal: false,
        fetchedAt: null,
        seats: [],
        error: "הרענון נכשל לפני שנשמרה תוצאה.",
      },
      { status: 500, headers: routeHeaders },
    );
  }
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
