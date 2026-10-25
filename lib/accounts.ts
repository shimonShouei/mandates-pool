import { safeEqual } from "./auth";
import type { Db } from "./db";
import { GameError } from "./game";
import { hashToken, newId, newToken } from "./ids";

export type ClaimResult = "claimed" | "already" | "skipped";

export function cleanEmail(input: string): string | null {
  const email = input.normalize("NFKC").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return null;
  return email;
}

/** Test and migration helper. Signing in through Auth.js creates the same row. */
export async function createAccount(db: Db, email: string, name: string | null = null) {
  const clean = cleanEmail(email);
  if (!clean) throw new GameError("המייל לא נראה תקין.");
  const existing = await db.get<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [clean]);
  if (existing) return { id: existing.id, email: clean };
  const id = newId();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, name, email, email_verified, image, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, clean, now, null, now],
  );
  return { id, email: clean };
}

/**
 * Attach an unclaimed device bet to this account and retire the device token.
 * A bet already owned by someone, or a second bet in the same group, is left alone.
 */
export async function claimCookieParticipant(
  db: Db,
  groupId: string,
  token: string | null,
  userId: string,
): Promise<ClaimResult> {
  if (!token) return "skipped";
  const row = await db.get<{ id: string; user_id: string | null }>(
    `SELECT id, user_id FROM participants WHERE group_id = ? AND token_hash = ?`,
    [groupId, hashToken(token)],
  );
  if (!row) return "skipped";
  if (row.user_id === userId) return "already";
  if (row.user_id) return "skipped";
  const mine = await db.get<{ id: string }>(`SELECT id FROM participants WHERE group_id = ? AND user_id = ?`, [
    groupId,
    userId,
  ]);
  if (mine && mine.id !== row.id) return "skipped";
  const updated = await db.run(
    `UPDATE participants SET user_id = ?, token_hash = ? WHERE id = ? AND user_id IS NULL`,
    [userId, hashToken(newToken()), row.id],
  );
  return updated.changes > 0 ? "claimed" : "skipped";
}

/** The first signed-in holder of a still-unassigned backup link becomes the account admin. */
export async function claimGroupOwner(db: Db, groupId: string, token: string | null, userId: string): Promise<boolean> {
  if (!token) return false;
  const group = await db.get<{ admin_token_hash: string | null; owner_user_id: string | null }>(
    `SELECT admin_token_hash, owner_user_id FROM groups WHERE id = ?`,
    [groupId],
  );
  if (!group?.admin_token_hash || !safeEqual(group.admin_token_hash, hashToken(token))) return false;
  if (group.owner_user_id === userId) return true;
  if (group.owner_user_id) return false;
  const updated = await db.run(`UPDATE groups SET owner_user_id = ? WHERE id = ? AND owner_user_id IS NULL`, [
    userId,
    groupId,
  ]);
  return updated.changes > 0;
}

export type MyGroup = {
  code: string;
  name: string;
  alias: string;
};

export async function listMyGroups(db: Db, userId: string): Promise<MyGroup[]> {
  const rows = await db.all<{ code: string; name: string; display_name: string }>(
    `SELECT g.code, g.name, p.display_name
     FROM participants p
     JOIN groups g ON g.id = p.group_id
     WHERE p.user_id = ?
     ORDER BY p.created_at`,
    [userId],
  );
  return rows.map((row) => ({ code: row.code, name: row.name, alias: row.display_name }));
}
