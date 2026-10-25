import { cookies } from "next/headers";
import { adminCookieMatches, adminCookieValue } from "./auth";

const ADMIN_COOKIE = "mandates_admin";
const TOKEN_COOKIE = "mandates_tokens";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  };
}

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  return adminCookieMatches(secret, jar.get(ADMIN_COOKIE)?.value);
}

export async function setAdminCookie() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not set");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminCookieValue(secret), cookieOptions());
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

async function tokenMap(): Promise<Record<string, string>> {
  const jar = await cookies();
  const raw = jar.get(TOKEN_COOKIE)?.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export async function readToken(groupId: string): Promise<string | null> {
  const map = await tokenMap();
  const token = map[groupId];
  return typeof token === "string" ? token : null;
}

export async function writeToken(groupId: string, token: string) {
  const jar = await cookies();
  const map = await tokenMap();
  map[groupId] = token;
  jar.set(TOKEN_COOKIE, JSON.stringify(map), cookieOptions());
}

export async function clearToken(groupId: string) {
  const jar = await cookies();
  const map = await tokenMap();
  delete map[groupId];
  jar.set(TOKEN_COOKIE, JSON.stringify(map), cookieOptions());
}
