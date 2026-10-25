import type { Db } from "./db";
import { applyParsedResults, getSite } from "./game";
import { fetchOfficialResults, type FetchOutcome } from "./results/fetch-official";

const STALE_MS = 3 * 60 * 1000;

export async function ensureFreshSite(
  db: Db,
  options?: {
    force?: boolean;
    overrideManual?: boolean;
    fetcher?: (input: { knessetNumber: number }) => Promise<FetchOutcome>;
    now?: Date;
  },
): Promise<{ refreshed: boolean; error?: string }> {
  const site = await getSite(db);
  if (site.resultsOverride && !options?.overrideManual) return { refreshed: false };

  const now = options?.now ?? new Date();
  const stamp = now.toISOString();
  const cutoff = new Date(now.getTime() - STALE_MS).toISOString();
  const lock = options?.force
    ? await db.run(
        `UPDATE site SET last_fetch_attempt_at = ? WHERE id = 'site' AND (results_override = 0 OR ? = 1)`,
        [stamp, options.overrideManual ? 1 : 0],
      )
    : await db.run(
        `UPDATE site SET last_fetch_attempt_at = ?
         WHERE id = 'site' AND results_override = 0
           AND (last_fetch_attempt_at IS NULL OR last_fetch_attempt_at < ?)`,
        [stamp, cutoff],
      );
  if (lock.changes === 0) return { refreshed: false };

  const fetcher = options?.fetcher ?? ((input: { knessetNumber: number }) => fetchOfficialResults(input));
  let result;
  try {
    result = await fetcher({ knessetNumber: site.knessetNumber });
  } catch {
    const error = "הרענון מוועדת הבחירות נכשל באמצע.";
    await db.run(`UPDATE site SET last_fetch_error = ? WHERE id = 'site'`, [error]);
    return { refreshed: false, error };
  }
  if (!result.ok) {
    await db.run(`UPDATE site SET last_fetch_error = ? WHERE id = 'site'`, [result.error]);
    return { refreshed: false, error: result.error };
  }

  await applyParsedResults(db, result.parsed, {
    source: "official",
    sourceUrl: result.url,
  });
  if (options?.overrideManual) {
    await db.run(`UPDATE site SET results_override = 0, last_fetch_error = NULL WHERE id = 'site'`);
  } else {
    await db.run(`UPDATE site SET last_fetch_error = NULL WHERE id = 'site'`);
  }
  return { refreshed: true };
}

export async function refreshSite(
  db: Db,
  options?: { fetcher?: (input: { knessetNumber: number }) => Promise<FetchOutcome> },
) {
  return ensureFreshSite(db, { force: true, fetcher: options?.fetcher });
}
