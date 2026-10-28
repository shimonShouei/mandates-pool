const BIND_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

/** Hosts that are the process bind address, not a site a browser can keep cookies for. */
export function isBindHost(hostname: string): boolean {
  const bare = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return BIND_HOSTS.has(bare) || BIND_HOSTS.has(hostname.trim().toLowerCase());
}

function isLoopback(hostname: string): boolean {
  const bare = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return bare === "localhost" || bare === "127.0.0.1" || bare === "::1";
}

/**
 * Where to send the browser after sign-in.
 * Next dev bound to 0.0.0.0 reports that address as the request origin, which
 * is a different site from localhost and drops the session cookie. Stay on the
 * host the browser already used.
 */
export function authRedirect(url: string, baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return "/";
  }
  if (isBindHost(base.hostname)) {
    if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
    try {
      const target = new URL(url);
      if (isLoopback(target.hostname)) return target.toString();
    } catch {
      return "/";
    }
    return "/";
  }
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return `${base.origin}${url}`;
  }
  try {
    if (new URL(url).origin === base.origin) return url;
  } catch {
    return base.origin;
  }
  return base.origin;
}

/**
 * Vercel sets VERCEL_URL to the deployment host, without a scheme.
 * Used only when AUTH_URL is unset and the incoming host is not a browser host.
 * A set AUTH_URL wins so a custom domain is not replaced by the deployment host.
 */
export function deploymentHost(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.AUTH_URL || env.NEXTAUTH_URL) return null;
  const raw = env.VERCEL_URL?.trim();
  if (!raw) return null;
  return publicHost(raw.replace(/^https?:\/\//, ""));
}

/** A single host[:port] from a forwarded header, or null when it is not usable. */
export function publicHost(header: string | null): string | null {
  if (!header) return null;
  const host = header.split(",")[0]?.trim().toLowerCase() ?? "";
  const named = /^[a-z0-9.-]+(?::\d+)?$/;
  const ipv6 = /^\[[0-9a-f:]+\](?::\d+)?$/;
  if (!named.test(host) && !ipv6.test(host)) return null;
  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.replace(/:\d+$/, "");
  if (isBindHost(hostname)) return null;
  return host;
}
