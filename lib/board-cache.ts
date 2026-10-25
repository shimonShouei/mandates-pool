import type { Db } from "./db";
import { loadScoreContext } from "./game";
import { computeWinnings, parseStoredSplit, type GroupStake } from "./payout";
import type { GlobalStanding, GroupStanding, PublicResults, PublicStandingsPayload } from "./public-state";
import { buildStandings, roundScore, toPublicStandings, type InternalStanding } from "./scoring";
import { checkSeatVector } from "./seats";

const GLOBAL_ID = "global";
const LOCK_MS = 15_000;

export type PartyMeta = { id: string; name: string; ballot: string; color: string };

export type StoredGroupBoard = {
  participantCount: number;
  completeCount: number;
  aliases: string[];
  fetchProblem: string | null;
  results: PublicResults | null;
  standings: GroupStanding[];
  stake: GroupStake | null;
  thresholdBonus: number;
  scoreable: boolean;
  partyCount: number;
  knessetNumber: number;
  actual: Record<string, number>;
  parties: PartyMeta[];
};

type StoredGlobal = {
  scoreable: boolean;
  thresholdBonus: number;
  partyCount: number;
  rows: GlobalStanding[];
};

type CacheRow = { cache_key: string; payload: string; lock_until: string | null };

export async function readGroupBoard(db: Db, groupId: string): Promise<StoredGroupBoard> {
  await ensureBoards(db);
  const row = await db.get<{ payload: string }>(`SELECT payload FROM board_cache WHERE id = ?`, [groupId]);
  if (!row?.payload) return emptyGroup();
  return JSON.parse(row.payload) as StoredGroupBoard;
}

export async function readGlobalRows(db: Db): Promise<StoredGlobal> {
  await ensureBoards(db);
  const row = await db.get<{ payload: string }>(`SELECT payload FROM board_cache WHERE id = ?`, [GLOBAL_ID]);
  if (!row?.payload) return { scoreable: false, thresholdBonus: 0, partyCount: 0, rows: [] };
  return JSON.parse(row.payload) as StoredGlobal;
}

export function publicGroupFields(board: StoredGroupBoard): PublicStandingsPayload {
  return {
    participantCount: board.participantCount,
    completeCount: board.completeCount,
    aliases: board.aliases,
    fetchProblem: board.fetchProblem,
    results: board.results,
    standings: board.standings.map((row) => ({
      ...row,
      isYou: false,
      winningsAgorot: row.winningsAgorot ?? 0,
    })),
    stake: board.stake ?? null,
    thresholdBonus: board.thresholdBonus,
    partyCount: board.partyCount,
    scoreable: board.scoreable,
  };
}

async function ensureBoards(db: Db): Promise<void> {
  const key = await boardKey(db);
  const current = await db.get<CacheRow>(
    `SELECT cache_key, payload, lock_until FROM board_cache WHERE id = ?`,
    [GLOBAL_ID],
  );
  if (current?.cache_key === key && current.payload) return;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const until = new Date(now + LOCK_MS).toISOString();
  const lockKey = `lock:${key}`;
  const gotLock = await takeLock(db, current, key, lockKey, nowIso, until);
  if (!gotLock) return;

  const { global, groups } = await computeAll(db);
  const computedAt = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM board_cache`);
    await tx.run(
      `INSERT INTO board_cache (id, cache_key, payload, computed_at, lock_until) VALUES (?, ?, ?, ?, NULL)`,
      [GLOBAL_ID, key, JSON.stringify(global), computedAt],
    );
    for (const [groupId, payload] of groups) {
      await tx.run(
        `INSERT INTO board_cache (id, cache_key, payload, computed_at, lock_until) VALUES (?, ?, ?, ?, NULL)`,
        [groupId, key, JSON.stringify(payload), computedAt],
      );
    }
  });
}

async function takeLock(
  db: Db,
  current: CacheRow | undefined,
  key: string,
  lockKey: string,
  nowIso: string,
  until: string,
): Promise<boolean> {
  if (!current) {
    try {
      await db.run(
        `INSERT INTO board_cache (id, cache_key, payload, computed_at, lock_until) VALUES (?, ?, '', ?, ?)`,
        [GLOBAL_ID, lockKey, nowIso, until],
      );
      return true;
    } catch (error) {
      if (!isUnique(error)) throw error;
      const raced = await db.get<CacheRow>(
        `SELECT cache_key, payload, lock_until FROM board_cache WHERE id = ?`,
        [GLOBAL_ID],
      );
      if (raced?.cache_key === key && raced.payload) return false;
      if (raced?.lock_until && raced.lock_until > nowIso) return false;
    }
  }
  const taken = await db.run(
    `UPDATE board_cache SET cache_key = ?, lock_until = ? WHERE id = ? AND cache_key != ? AND (lock_until IS NULL OR lock_until < ?)`,
    [lockKey, until, GLOBAL_ID, key, nowIso],
  );
  if (taken.changes > 0) return true;
  const again = await db.get<CacheRow>(
    `SELECT cache_key, payload, lock_until FROM board_cache WHERE id = ?`,
    [GLOBAL_ID],
  );
  if (again?.cache_key === key && again.payload) return false;
  if (again?.lock_until && again.lock_until > nowIso) return false;
  await db.run(`UPDATE board_cache SET cache_key = ?, lock_until = ? WHERE id = ?`, [lockKey, until, GLOBAL_ID]);
  return true;
}

async function boardKey(db: Db): Promise<string> {
  const row = await db.get<{
    rev: string | number | null;
    bonus: string | number | null;
    snap: string | null;
    preds: string | null;
    groups: string | null;
    stake: string | null;
    people: string | number | null;
  }>(
    `SELECT
       (SELECT CAST(board_revision AS TEXT) FROM site WHERE id = 'site') AS rev,
       (SELECT CAST(threshold_bonus AS TEXT) FROM site WHERE id = 'site') AS bonus,
       (SELECT id || '|' || fetched_at || '|' || CAST(scoreable AS TEXT) || '|' || seat_method
          FROM result_snapshots ORDER BY fetched_at DESC LIMIT 1) AS snap,
       (SELECT COALESCE(MAX(updated_at), '') || '|' || CAST(COUNT(*) AS TEXT) FROM predictions) AS preds,
       (SELECT CAST(COUNT(*) AS TEXT) || '|' || CAST(COALESCE(SUM(public_board), 0) AS TEXT) || '|' || CAST(COALESCE(SUM(LENGTH(name)), 0) AS TEXT)
          FROM groups) AS groups,
       (SELECT CAST(COALESCE(SUM(stake_agorot), 0) AS TEXT) || '|' || CAST(COALESCE(SUM(LENGTH(payout_split)), 0) AS TEXT)
          FROM groups) AS stake,
       (SELECT CAST(COUNT(*) AS TEXT) FROM participants) AS people`,
  );
  return `stake|${row?.rev ?? 0}|${row?.bonus ?? ""}|${row?.snap ?? ""}|${row?.preds ?? ""}|${row?.groups ?? ""}|${row?.stake ?? ""}|${row?.people ?? 0}`;
}

async function computeAll(db: Db): Promise<{ global: StoredGlobal; groups: Map<string, StoredGroupBoard> }> {
  const { site, parties, actual, results, scoreable } = await loadScoreContext(db);
  const partyIds = parties.map((party) => party.id);
  const partyMeta: PartyMeta[] = parties.map((party) => ({
    id: party.id,
    name: party.name,
    ballot: party.ballot,
    color: party.color,
  }));
  const weight = site.thresholdBonus;
  const groupRows = await db.all<{
    id: string;
    name: string;
    code: string;
    public_board: number;
    stake_agorot: number | null;
    payout_split: string | null;
  }>(`SELECT id, name, code, public_board, stake_agorot, payout_split FROM groups`);
  const people = await db.all<{ id: string; group_id: string; display_name: string }>(
    `SELECT id, group_id, display_name FROM participants ORDER BY created_at`,
  );
  const predictions = await db.all<{ participant_id: string; party_id: string; seats: number }>(
    `SELECT participant_id, party_id, seats FROM predictions`,
  );
  const byPerson = new Map<string, Record<string, number>>();
  for (const row of predictions) {
    const bag = byPerson.get(row.participant_id) ?? {};
    bag[row.party_id] = Number(row.seats);
    byPerson.set(row.participant_id, bag);
  }
  const byGroup = new Map<string, { id: string; display_name: string }[]>();
  for (const person of people) {
    const list = byGroup.get(person.group_id) ?? [];
    list.push(person);
    byGroup.set(person.group_id, list);
  }

  const groups = new Map<string, StoredGroupBoard>();
  const globalPeople: {
    id: string;
    alias: string;
    groupName: string;
    groupCode: string;
    standing: InternalStanding;
  }[] = [];

  for (const group of groupRows) {
    const members = byGroup.get(group.id) ?? [];
    const complete = members.filter((person) => {
      const predicted = byPerson.get(person.id) ?? {};
      return checkSeatVector(partyIds.map((id) => predicted[id] ?? 0)).ok;
    });
    const internal = scoreable
      ? buildStandings(
          partyIds,
          actual,
          complete.map((person) => ({
            id: person.id,
            alias: person.display_name,
            predicted: byPerson.get(person.id) ?? {},
          })),
          weight,
        )
      : [];
    const buyInAgorot = Number(group.stake_agorot) || 0;
    const split = parseStoredSplit(group.payout_split);
    const payout = computeWinnings({
      buyInAgorot,
      participantCount: members.length,
      split,
      finishers: internal.map((row) => ({ id: row.participantId, rank: row.rank })),
    });
    const stake: GroupStake | null =
      buyInAgorot > 0 ? { buyInAgorot, potAgorot: payout.potAgorot, split } : null;
    groups.set(group.id, {
      participantCount: members.length,
      completeCount: complete.length,
      aliases: members.map((person) => person.display_name),
      fetchProblem: site.fetchError,
      results,
      standings: toPublicStandings(internal).map((row, index) => ({
        ...row,
        winningsAgorot: payout.byId.get(internal[index].participantId) ?? 0,
      })),
      stake,
      thresholdBonus: weight,
      scoreable,
      partyCount: partyIds.length,
      knessetNumber: site.knessetNumber,
      actual,
      parties: partyMeta,
    });
    if (Number(group.public_board) === 1) {
      for (const standing of internal) {
        globalPeople.push({
          id: standing.participantId,
          alias: standing.alias,
          groupName: group.name,
          groupCode: group.code,
          standing,
        });
      }
    }
  }

  globalPeople.sort(
    (a, b) =>
      a.standing.score - b.standing.score ||
      a.standing.euclidean - b.standing.euclidean ||
      a.alias.localeCompare(b.alias, "he") ||
      a.id.localeCompare(b.id),
  );
  let rank = 1;
  const rows: GlobalStanding[] = globalPeople.map((person, index) => {
    if (index > 0) {
      const previous = globalPeople[index - 1].standing;
      if (roundScore(person.standing.score) !== roundScore(previous.score) || roundScore(person.standing.euclidean) !== roundScore(previous.euclidean)) {
        rank = index + 1;
      }
    }
    return {
      rank,
      alias: person.alias,
      groupName: person.groupName,
      groupCode: person.groupCode,
      absolute: person.standing.absolute,
      misplaced: person.standing.misplaced,
      euclidean: roundScore(person.standing.euclidean),
      score: roundScore(person.standing.score),
      thresholdCorrect: person.standing.thresholdCorrect,
      groupRank: person.standing.rank,
    };
  });

  return {
    global: { scoreable, thresholdBonus: weight, partyCount: partyIds.length, rows },
    groups,
  };
}

function emptyGroup(): StoredGroupBoard {
  return {
    participantCount: 0,
    completeCount: 0,
    aliases: [],
    fetchProblem: null,
    results: null,
    standings: [],
    stake: null,
    thresholdBonus: 0,
    scoreable: false,
    partyCount: 0,
    knessetNumber: 26,
    actual: {},
    parties: [],
  };
}

function isUnique(error: unknown): boolean {
  return error instanceof Error && /unique/i.test(error.message);
}
