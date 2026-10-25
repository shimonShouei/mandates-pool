import type { Db } from "./db";
import { getDb } from "./db";
import { newId } from "./ids";

export function devInboxEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.AUTH_RESEND_KEY;
}

export async function storeDevMail(email: string, url: string, db?: Db) {
  const database = db ?? (await getDb());
  await database.run(`INSERT INTO dev_mailbox (id, email, url, created_at) VALUES (?, ?, ?, ?)`, [
    newId(),
    email.toLowerCase(),
    url,
    new Date().toISOString(),
  ]);
  await database.run(
    `DELETE FROM dev_mailbox WHERE id NOT IN (SELECT id FROM dev_mailbox ORDER BY created_at DESC LIMIT 20)`,
  );
}

export async function recentDevMail(db?: Db): Promise<{ email: string; url: string; createdAt: string }[]> {
  if (!devInboxEnabled()) return [];
  const database = db ?? (await getDb());
  const rows = await database.all<{ email: string; url: string; created_at: string }>(
    `SELECT email, url, created_at FROM dev_mailbox ORDER BY created_at DESC LIMIT 5`,
  );
  return rows.map((row) => ({ email: row.email, url: row.url, createdAt: row.created_at }));
}
