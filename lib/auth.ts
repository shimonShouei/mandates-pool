import { createHmac, timingSafeEqual } from "node:crypto";

export function adminCookieValue(secret: string): string {
  return createHmac("sha256", secret).update("mandates-admin-v1").digest("hex");
}

export function safeEqual(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function adminCookieMatches(secret: string, value: string | undefined): boolean {
  if (!secret || !value) return false;
  return safeEqual(adminCookieValue(secret), value);
}

export function bearerMatches(secret: string, header: string | null): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) return false;
  return safeEqual(secret, match[1]);
}
