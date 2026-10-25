import type { Db } from "./db";
import { GameError, createGroup } from "./game";
import { hashToken, newId } from "./ids";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_CREATES = 5;

export function clientIp(headerStore: { get(name: string): string | null }): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const hop = forwarded.split(",")[0]?.trim();
    if (hop) return hop.slice(0, 80);
  }
  const real = headerStore.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  return "local";
}

export async function createPublicGroup(db: Db, name: string, ip: string, now = Date.now()) {
  const ipHash = hashToken(ip || "local");
  const since = new Date(now - WINDOW_MS).toISOString();
  const row = await db.get<{ c: number | string }>(
    `SELECT COUNT(*) AS c FROM creation_log WHERE ip_hash = ? AND created_at >= ?`,
    [ipHash, since],
  );
  if (Number(row?.c ?? 0) >= MAX_CREATES) {
    throw new GameError("יותר מדי קבוצות חדשות מהרשת הזו. נסו שוב בעוד שעה.");
  }
  const group = await createGroup(db, name);
  await db.run(`INSERT INTO creation_log (id, ip_hash, created_at) VALUES (?, ?, ?)`, [
    newId(),
    ipHash,
    new Date(now).toISOString(),
  ]);
  return group;
}
