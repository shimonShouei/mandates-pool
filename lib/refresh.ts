import type { Db } from "./db";
import { applyParsedResults, getSite, listAgreements, listCatalog } from "./game";
import { decideSeats } from "./results/decide";
import { cronReaderOptions, fetchOfficialResults, type FetchOutcome } from "./results/fetch-official";
import type { ParsedResults } from "./results/parse-cec";

const STALE_MS = 3 * 60 * 1000;

export type ResultSeat = { name: string; ballot: string; seats: number };

export type ResultsRefreshReport = {
  updated: boolean;
  reason: string;
  source: "official" | "upload" | "manual" | null;
  percentCounted: number | null;
  isFinal: boolean;
  fetchedAt: string | null;
  seats: ResultSeat[];
  error: string | null;
};

type StoredResult = {
  status: "provisional" | "final";
  source: "official" | "upload" | "manual";
  countedPercent: number | null;
  fetchedAt: string;
  validVotes: number | null;
  scoreable: boolean;
  seats: ResultSeat[];
};

/** Keep a stored count unless the fetch is final, newer, or more complete. */
export function adoptionDecision(
  stored: Pick<StoredResult, "status" | "countedPercent" | "fetchedAt" | "validVotes"> | null,
  incoming: {
    status: "provisional" | "final";
    countedPercent: number | null;
    reportedAt: string | null;
    validVotes: number | null;
  },
): { adopt: boolean; reason: string } {
  if (!stored) return { adopt: true, reason: "empty" };
  if (stored.status === "final") return { adopt: false, reason: "already-final" };
  if (incoming.status === "final") return { adopt: true, reason: "fetched-final" };

  const fewerVotes =
    stored.validVotes != null && incoming.validVotes != null && incoming.validVotes < stored.validVotes;
  const moreVotes =
    incoming.validVotes != null && stored.validVotes != null && incoming.validVotes > stored.validVotes;
  const higherPercent =
    incoming.countedPercent != null &&
    stored.countedPercent != null &&
    incoming.countedPercent > stored.countedPercent + 0.05;
  const lowerPercent =
    incoming.countedPercent != null &&
    stored.countedPercent != null &&
    incoming.countedPercent + 0.05 < stored.countedPercent;
  const incomingAt = incoming.reportedAt ? Date.parse(incoming.reportedAt) : Number.NaN;
  const storedAt = Date.parse(stored.fetchedAt);
  const newer = Number.isFinite(incomingAt) && Number.isFinite(storedAt) && incomingAt > storedAt;

  if (fewerVotes || lowerPercent) return { adopt: false, reason: "less-complete" };
  if (higherPercent) return { adopt: true, reason: "higher-percent" };
  if (moreVotes) return { adopt: true, reason: newer ? "newer" : "more-votes" };
  if (newer) return { adopt: true, reason: "newer" };
  return { adopt: false, reason: "not-newer" };
}

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
  const stored = await loadResultView(db);
  if (stored?.status === "final") return { refreshed: false };
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

  const integrated = await integrateOfficialFetch(db, result.parsed, result.url, stored);
  if (!integrated.updated) {
    await db.run(`UPDATE site SET last_fetch_error = NULL WHERE id = 'site'`);
    return { refreshed: false, error: skipMessage(integrated.reason) };
  }
  if (options?.overrideManual) {
    await db.run(`UPDATE site SET results_override = 0, last_fetch_error = NULL WHERE id = 'site'`);
  } else {
    await db.run(`UPDATE site SET last_fetch_error = NULL WHERE id = 'site'`);
  }
  return { refreshed: true };
}

/**
 * Cron entry. Ignores the manual-override pause and the three-minute visitor lock.
 * A final snapshot is returned as-is. A provisional snapshot is replaced only when
 * the fetch is final, newer, or more complete.
 */
export async function scheduledResultsRefresh(
  db: Db,
  options?: {
    fetcher?: (input: { knessetNumber: number }) => Promise<FetchOutcome>;
    now?: Date;
  },
): Promise<ResultsRefreshReport> {
  const stored = await loadResultView(db);
  if (stored?.status === "final") return toReport(stored, { updated: false, reason: "already-final" });

  const site = await getSite(db);
  const stamp = (options?.now ?? new Date()).toISOString();
  await db.run(`UPDATE site SET last_fetch_attempt_at = ? WHERE id = 'site'`, [stamp]);
  const fetcher =
    options?.fetcher ??
    ((input: { knessetNumber: number }) => fetchOfficialResults({ ...input, ...cronReaderOptions }));
  let result: FetchOutcome;
  try {
    result = await fetcher({ knessetNumber: site.knessetNumber });
  } catch {
    const error = "הרענון מוועדת הבחירות נכשל באמצע.";
    await db.run(`UPDATE site SET last_fetch_error = ? WHERE id = 'site'`, [error]);
    return toReport(stored, { updated: false, reason: "fetch-failed", error });
  }
  if (!result.ok) {
    await db.run(`UPDATE site SET last_fetch_error = ? WHERE id = 'site'`, [result.error]);
    return toReport(stored, { updated: false, reason: "fetch-failed", error: result.error });
  }

  const integrated = await integrateOfficialFetch(db, result.parsed, result.url, stored);
  if (!integrated.updated) {
    await db.run(`UPDATE site SET last_fetch_error = NULL WHERE id = 'site'`);
    return toReport(stored, { updated: false, reason: integrated.reason });
  }
  await db.run(`UPDATE site SET results_override = 0, last_fetch_error = NULL WHERE id = 'site'`);
  return toReport(await loadResultView(db), { updated: true, reason: integrated.reason });
}

export async function refreshSite(
  db: Db,
  options?: { fetcher?: (input: { knessetNumber: number }) => Promise<FetchOutcome> },
) {
  return scheduledResultsRefresh(db, options);
}

function skipMessage(reason: string): string {
  if (reason === "less-complete") return "הנתונים מוועדת הבחירות ישנים או חלקיים יותר מהשמורים. לא דרסנו אותם.";
  if (reason === "not-newer") return "התוצאה השמורה חדשה לפחות כמו מה שנמשך. לא דרסנו אותה.";
  if (reason === "not-scoreable") return "התוצאה שנמשכה לא ניתנת לדירוג. לא דרסנו את השמורה.";
  if (reason === "already-final") return "התוצאות השמורות סופיות.";
  return "לא עדכנו את התוצאה השמורה.";
}

async function integrateOfficialFetch(
  db: Db,
  parsed: ParsedResults,
  sourceUrl: string,
  stored: StoredResult | null,
): Promise<{ updated: boolean; reason: string }> {
  const site = await getSite(db);
  const parties = await listCatalog(db);
  const agreements = await listAgreements(db);
  const decision = decideSeats({
    parsed,
    parties: parties.map((party) => ({
      id: party.id,
      name: party.name,
      ballot: party.ballot,
      matchKeys: party.matchKeys,
    })),
    agreements: agreements.map((item) => ({ a: item.partyAId, b: item.partyBId })),
    preferComputed: site.preferComputed,
  });
  if (!decision.scoreable) return { updated: false, reason: "not-scoreable" };

  const voteSum = parsed.lists.reduce((sum, list) => sum + (list.votes ?? 0), 0);
  const incomingVotes = parsed.validVotes ?? (parsed.lists.some((list) => list.votes != null) ? voteSum : null);
  const adoption = adoptionDecision(stored, {
    status: parsed.status,
    countedPercent: parsed.countedPercent,
    reportedAt: parsed.reportedAt ?? null,
    validVotes: incomingVotes,
  });
  if (!adoption.adopt) return { updated: false, reason: adoption.reason };

  await applyParsedResults(db, parsed, {
    source: "official",
    sourceUrl,
    fetchedAt: parsed.reportedAt ?? new Date().toISOString(),
  });
  return { updated: true, reason: adoption.reason };
}

function toReport(
  view: StoredResult | null,
  extra: { updated: boolean; reason: string; error?: string | null },
): ResultsRefreshReport {
  return {
    updated: extra.updated,
    reason: extra.reason,
    source: view?.source ?? null,
    percentCounted: view?.countedPercent ?? null,
    isFinal: view?.status === "final",
    fetchedAt: view?.fetchedAt ?? null,
    seats: view?.seats ?? [],
    error: extra.error ?? null,
  };
}

async function loadResultView(db: Db): Promise<StoredResult | null> {
  const snapshot = await db.get<{
    id: string;
    status: "provisional" | "final";
    source: "official" | "upload" | "manual";
    counted_percent: number | string | null;
    fetched_at: string;
    valid_votes: number | string | null;
    scoreable: number | string;
  }>(
    `SELECT id, status, source, counted_percent, fetched_at, valid_votes, scoreable
     FROM result_snapshots WHERE is_current = 1 ORDER BY fetched_at DESC LIMIT 1`,
  );
  if (!snapshot) return null;
  const rows = await db.all<{
    source_name: string;
    source_ballot: string;
    seats: number | string;
    votes: number | string | null;
  }>(
    `SELECT source_name, source_ballot, seats, votes FROM result_rows WHERE snapshot_id = ? ORDER BY seats DESC, source_name`,
    [snapshot.id],
  );
  const anyVotes = rows.some((row) => row.votes != null);
  const voteSum = rows.reduce((sum, row) => sum + (row.votes == null ? 0 : Number(row.votes)), 0);
  return {
    status: snapshot.status,
    source: snapshot.source,
    countedPercent: snapshot.counted_percent == null ? null : Number(snapshot.counted_percent),
    fetchedAt: snapshot.fetched_at,
    validVotes: snapshot.valid_votes == null ? (anyVotes ? voteSum : null) : Number(snapshot.valid_votes),
    scoreable: Number(snapshot.scoreable) === 1,
    seats: rows.map((row) => ({
      name: row.source_name,
      ballot: row.source_ballot,
      seats: Number(row.seats),
    })),
  };
}
