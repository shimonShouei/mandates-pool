/** Optional support link. Empty or non-http values stay hidden. */
export function donationUrl(): string | null {
  const raw = process.env.DONATION_URL?.trim() ?? "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
