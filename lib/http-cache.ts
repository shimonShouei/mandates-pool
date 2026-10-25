/** Public boards only. Browsers revalidate; the CDN may serve this for half a minute and a stale copy while it refreshes. */
export const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=120";

export function publicCacheHeaders(): Record<string, string> {
  const edge = "public, s-maxage=30, stale-while-revalidate=120";
  return {
    "cache-control": PUBLIC_CACHE_CONTROL,
    "cdn-cache-control": edge,
    "vercel-cdn-cache-control": edge,
  };
}

export function privateCacheHeaders(): Record<string, string> {
  return { "cache-control": "private, no-store" };
}
