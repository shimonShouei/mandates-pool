import { handlers } from "@/auth";
import { deploymentHost, publicHost } from "@/lib/public-origin";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `next dev -H 0.0.0.0` builds the request URL on the bind address. Auth.js
 * then treats localhost and 127.0.0.1 as other sites. Rewrite onto the host
 * the browser sent before the session cookie is issued.
 */
function withBrowserHost(req: NextRequest): NextRequest {
  const current = new URL(req.url);
  if (current.hostname !== "0.0.0.0" && current.hostname !== "::") return req;
  const host =
    publicHost(req.headers.get("x-forwarded-host")) ??
    publicHost(req.headers.get("host")) ??
    deploymentHost();
  if (!host) return req;
  const proto = (req.headers.get("x-forwarded-proto") ?? current.protocol.replace(":", "")).split(",")[0].trim();
  const next = new URL(req.url);
  const published = new URL(`${proto}://${host}`);
  next.protocol = published.protocol;
  next.hostname = published.hostname;
  next.port = published.port;
  return new NextRequest(next, req);
}

export function GET(req: NextRequest) {
  return handlers.GET(withBrowserHost(req));
}

export function POST(req: NextRequest) {
  return handlers.POST(withBrowserHost(req));
}
