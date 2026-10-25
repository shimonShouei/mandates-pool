import type { Db } from "./db";
import { loadScoreContext } from "./game";
import type { BoardMetric, GlobalBoard, GlobalStanding } from "./public-state";
import { alignVectors, euclideanDistance, roundScore, sumAbsoluteError } from "./scoring";
import { KNESSET_SEATS } from "./seats";

const DEFAULT_PAGE_SIZE = 40;

type Scored = {
  id: string;
  alias: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  euclidean: number;
  absolute: number;
};

type CacheEntry = { key: string; rows: GlobalStanding[]; scoreable: boolean };

const caches = new WeakMap<Db, CacheEntry>();

export async function globalLeaderboard(
  db: Db,
  options?: { page?: number; pageSize?: number; metric?: string },
): Promise<GlobalBoard> {
  const metric: BoardMetric = options?.metric === "absolute" ? "absolute" : "euclidean";
  const pageSize = clampPageSize(options?.pageSize);
  const entry = await cachedRows(db);
  const ordered =
    metric === "euclidean"
      ? entry.rows
      : [...entry.rows].sort(
          (a, b) => a.absoluteRank - b.absoluteRank || a.euclidean - b.euclidean || a.alias.localeCompare(b.alias, "he"),
        );
  const total = ordered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options?.page || 1)), pageCount);
  const start = (page - 1) * pageSize;
  return {
    metric,
    page,
    pageSize,
    total,
    pageCount,
    scoreable: entry.scoreable,
    rows: ordered.slice(start, start + pageSize),
  };
}

async function cachedRows(db: Db): Promise<CacheEntry> {
  const key = await boardKey(db);
  const hit = caches.get(db);
  if (hit && hit.key === key) return hit;
  const fresh = await computeRows(db);
  const entry = { key, ...fresh };
  caches.set(db, entry);
  return entry;
}

async function boardKey(db: Db): Promise<string> {
  const row = await db.get<{
    rev: number | string | null;
    snap: string | null;
    preds: string | null;
    groups: string | null;
  }>(
    `SELECT
       (SELECT CAST(board_revision AS TEXT) FROM site WHERE id = 'site') AS rev,
       (SELECT id || '|' || fetched_at || '|' || CAST(scoreable AS TEXT) || '|' || seat_method
          FROM result_snapshots ORDER BY fetched_at DESC LIMIT 1) AS snap,
       (SELECT COALESCE(MAX(updated_at), '') || '|' || CAST(COUNT(*) AS TEXT) FROM predictions) AS preds,
       (SELECT CAST(COUNT(*) AS TEXT) || '|' || CAST(COALESCE(SUM(public_board), 0) AS TEXT) || '|' || CAST(COALESCE(SUM(LENGTH(name)), 0) AS TEXT)
          FROM groups) AS groups`,
  );
  return `${row?.rev ?? 0}|${row?.snap ?? ""}|${row?.preds ?? ""}|${row?.groups ?? ""}`;
}

async function computeRows(db: Db): Promise<{ rows: GlobalStanding[]; scoreable: boolean }> {
  const { parties, actual, scoreable } = await loadScoreContext(db);
  if (!scoreable) return { rows: [], scoreable: false };
  const partyIds = parties.map((party) => party.id);

  const people = await db.all<{
    id: string;
    alias: string;
    group_id: string;
    group_name: string;
    group_code: string;
    seat_sum: number | string;
  }>(
    `SELECT p.id AS id, p.display_name AS alias, g.id AS group_id, g.name AS group_name, g.code AS group_code,
            SUM(pr.seats) AS seat_sum
     FROM participants p
     JOIN groups g ON g.id = p.group_id
     JOIN predictions pr ON pr.participant_id = p.id
     WHERE g.public_board = 1
     GROUP BY p.id, p.display_name, g.id, g.name, g.code
     HAVING SUM(pr.seats) = ?`,
    [KNESSET_SEATS],
  );
  if (people.length === 0) return { rows: [], scoreable: true };

  const predictions = await db.all<{ participant_id: string; party_id: string; seats: number }>(
    `SELECT pr.participant_id AS participant_id, pr.party_id AS party_id, pr.seats AS seats
     FROM predictions pr
     JOIN participants p ON p.id = pr.participant_id
     JOIN groups g ON g.id = p.group_id
     WHERE g.public_board = 1`,
  );
  const byPerson = new Map<string, Record<string, number>>();
  for (const row of predictions) {
    const bag = byPerson.get(row.participant_id) ?? {};
    bag[row.party_id] = Number(row.seats);
    byPerson.set(row.participant_id, bag);
  }

  const scored: Scored[] = [];
  for (const person of people) {
    if (Number(person.seat_sum) !== KNESSET_SEATS) continue;
    const predicted = byPerson.get(person.id) ?? {};
    const vectors = alignVectors(partyIds, predicted, actual);
    scored.push({
      id: person.id,
      alias: person.alias,
      groupId: person.group_id,
      groupName: person.group_name,
      groupCode: person.group_code,
      euclidean: euclideanDistance(vectors.predicted, vectors.actual),
      absolute: sumAbsoluteError(vectors.predicted, vectors.actual),
    });
  }

  const euclideanRanks = competitionRanks(scored, (row) => row.euclidean);
  const absoluteRanks = competitionRanks(scored, (row) => row.absolute);
  const groupEuclidean = new Map<string, number>();
  const groupAbsolute = new Map<string, number>();
  const byGroup = new Map<string, Scored[]>();
  for (const row of scored) {
    const list = byGroup.get(row.groupId) ?? [];
    list.push(row);
    byGroup.set(row.groupId, list);
  }
  for (const list of byGroup.values()) {
    for (const [id, rank] of competitionRanks(list, (row) => row.euclidean)) groupEuclidean.set(id, rank);
    for (const [id, rank] of competitionRanks(list, (row) => row.absolute)) groupAbsolute.set(id, rank);
  }

  const rows = scored
    .map((row) => ({
      rank: euclideanRanks.get(row.id) ?? 0,
      absoluteRank: absoluteRanks.get(row.id) ?? 0,
      alias: row.alias,
      groupName: row.groupName,
      groupCode: row.groupCode,
      euclidean: roundScore(row.euclidean),
      absolute: row.absolute,
      groupRank: groupEuclidean.get(row.id) ?? 0,
      groupAbsoluteRank: groupAbsolute.get(row.id) ?? 0,
    }))
    .sort((a, b) => a.rank - b.rank || a.absolute - b.absolute || a.alias.localeCompare(b.alias, "he"));
  return { rows, scoreable: true };
}

function competitionRanks(rows: Scored[], score: (row: Scored) => number): Map<string, number> {
  const ordered = [...rows].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));
  const ranks = new Map<string, number>();
  let previous: number | null = null;
  let rank = 0;
  ordered.forEach((row, index) => {
    const value = score(row);
    if (previous === null || value !== previous) {
      rank = index + 1;
      previous = value;
    }
    ranks.set(row.id, rank);
  });
  return ranks;
}

function clampPageSize(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(100, Math.max(1, Math.floor(value)));
}
