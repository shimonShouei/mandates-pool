import type { Db } from "./db";
import { applyParsedResults, getGroupById } from "./game";
import { fetchOfficialResults, type FetchOutcome } from "./results/fetch-official";

const STALE_MS = 3 * 60 * 1000;

export async function ensureFreshResults(
  db: Db,
  groupId: string,
  options?: {
    force?: boolean;
    overrideManual?: boolean;
    fetcher?: (input: { knessetNumber: number }) => Promise<FetchOutcome>;
    now?: Date;
  },
): Promise<{ refreshed: boolean; error?: string }> {
  const group = await getGroupById(db, groupId);
  if (!group) return { refreshed: false, error: "הקבוצה לא נמצאה." };
  if (group.resultsOverride && !options?.overrideManual) return { refreshed: false };

  const now = options?.now ?? new Date();
  if (!options?.force && group.lastFetchAttemptAt) {
    const age = now.getTime() - Date.parse(group.lastFetchAttemptAt);
    if (age >= 0 && age < STALE_MS) return { refreshed: false };
  }

  const stamp = now.toISOString();
  const cutoff = new Date(now.getTime() - STALE_MS).toISOString();
  const lock = options?.force
    ? await db.run(
        `UPDATE groups SET last_fetch_attempt_at = ? WHERE id = ? AND (results_override = 0 OR ? = 1)`,
        [stamp, groupId, options.overrideManual ? 1 : 0],
      )
    : await db.run(
        `UPDATE groups SET last_fetch_attempt_at = ?
         WHERE id = ? AND results_override = 0
           AND (last_fetch_attempt_at IS NULL OR last_fetch_attempt_at < ?)`,
        [stamp, groupId, cutoff],
      );
  if (lock.changes === 0) return { refreshed: false };

  const fetcher = options?.fetcher ?? ((input: { knessetNumber: number }) => fetchOfficialResults(input));
  let result;
  try {
    result = await fetcher({ knessetNumber: group.knessetNumber });
  } catch {
    const error = "הרענון מוועדת הבחירות נכשל באמצע.";
    await db.run(`UPDATE groups SET last_fetch_error = ? WHERE id = ?`, [error, groupId]);
    return { refreshed: false, error };
  }
  if (!result.ok) {
    await db.run(`UPDATE groups SET last_fetch_error = ? WHERE id = ?`, [result.error, groupId]);
    return { refreshed: false, error: result.error };
  }

  await applyParsedResults(db, groupId, result.parsed, {
    source: "official",
    sourceUrl: result.url,
  });
  if (options?.overrideManual) {
    await db.run(`UPDATE groups SET results_override = 0, last_fetch_error = NULL WHERE id = ?`, [groupId]);
  } else {
    await db.run(`UPDATE groups SET last_fetch_error = NULL WHERE id = ?`, [groupId]);
  }
  return { refreshed: true };
}

export async function refreshAllGroups(
  db: Db,
  options?: { fetcher?: (input: { knessetNumber: number }) => Promise<FetchOutcome> },
) {
  const { listGroups } = await import("./game");
  const groups = await listGroups(db);
  const results = [];
  for (const group of groups) {
    const outcome = await ensureFreshResults(db, group.id, { force: true, fetcher: options?.fetcher });
    results.push({ code: group.code, ...outcome });
  }
  return results;
}
