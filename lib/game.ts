import { safeEqual } from "./auth";
import type { Db } from "./db";
import { cleanDisplayName, hashToken, nameKey, newCode, newId, newToken } from "./ids";
import type { AdminParticipant, OwnView, PublicGroupState, PublicResults } from "./public-state";
import { decideSeats, type PartyRef } from "./results/decide";
import type { ParsedList, ParsedResults } from "./results/parse-cec";
import { buildStandings, roundScore, toPublicStandings } from "./scoring";
import { KNESSET_SEATS, checkSeatVector } from "./seats";
import { betsLocked, isLocked, lockSchedule, pollsOpenIso } from "./time";

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

export type Party = {
  id: string;
  name: string;
  ballot: string;
  color: string;
  sortOrder: number;
  matchKeys: string[];
};

export type Agreement = {
  id: string;
  partyAId: string;
  partyBId: string;
  partyAName: string;
  partyBName: string;
};

type GroupRow = {
  id: string;
  name: string;
  code: string;
  deadline: string | null;
  election_start: string | null;
  public_board: number;
  admin_token_hash: string | null;
  created_at: string;
};

export type SiteSettings = {
  knessetNumber: number;
  preferComputed: boolean;
  resultsOverride: boolean;
  lastFetchAttemptAt: string | null;
  fetchError: string | null;
};

type SnapshotRow = {
  id: string;
  fetched_at: string;
  status: "provisional" | "final";
  source: "official" | "upload" | "manual";
  seat_method: PublicResults["seatMethod"];
  source_url: string | null;
  counted_percent: number | null;
  turnout_percent: number | null;
  eligible_voters: number | null;
  ballots_cast: number | null;
  valid_votes: number | null;
  invalid_votes: number | null;
  scoreable: number;
  note: string | null;
};

type ResultRow = {
  id: string;
  party_id: string | null;
  source_name: string;
  source_ballot: string;
  votes: number | null;
  official_seats: number | null;
  seats: number;
  passed_threshold: number;
  mapped: number;
};

export async function createGroup(
  db: Db,
  name: string,
  deadlineIso: string | null = null,
  electionStartIso: string | null = null,
) {
  const raw = name.normalize("NFKC");
  if (/[\u0000-\u001f]/.test(raw)) throw new GameError("שם הקבוצה צריך להיות בין 2 ל-40 תווים.");
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 40) {
    throw new GameError("שם הקבוצה צריך להיות בין 2 ל-40 תווים.");
  }
  const electionStart = electionStartIso ?? pollsOpenIso();
  if (Number.isNaN(Date.parse(electionStart))) throw new GameError("שעת פתיחת הקלפיות לא תקינה.");
  const adminToken = newToken();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = newId();
    const code = newCode();
    const now = new Date().toISOString();
    try {
      await db.run(
        `INSERT INTO groups (id, name, code, deadline, election_start, public_board, admin_token_hash, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, clean, code, deadlineIso, electionStart, hashToken(adminToken), now],
      );
      return { id, code, name: clean, adminToken };
    } catch (error) {
      if (isUnique(error) && attempt < 4) continue;
      throw error;
    }
  }
  throw new GameError("לא הצלחנו ליצור קוד קבוצה.");
}

export async function listGroups(db: Db) {
  const rows = await db.all<GroupRow>(`SELECT * FROM groups ORDER BY created_at DESC`);
  return rows.map(presentGroup);
}

export async function getGroupByCode(db: Db, code: string) {
  const row = await db.get<GroupRow>(`SELECT * FROM groups WHERE code = ?`, [code.trim().toUpperCase()]);
  return row ? presentGroup(row) : null;
}

export async function getGroupById(db: Db, id: string) {
  const row = await db.get<GroupRow>(`SELECT * FROM groups WHERE id = ?`, [id]);
  return row ? presentGroup(row) : null;
}

export async function updateGroup(
  db: Db,
  groupId: string,
  patch: {
    name?: string;
    deadline?: string | null;
    electionStart?: string;
    publicBoard?: boolean;
  },
) {
  const group = await mustGroup(db, groupId);
  let name = group.name;
  if (patch.name != null) {
    const raw = patch.name.normalize("NFKC");
    if (/[\u0000-\u001f]/.test(raw)) throw new GameError("שם הקבוצה צריך להיות בין 2 ל-40 תווים.");
    name = raw.replace(/\s+/g, " ").trim();
  }
  if (name.length < 2 || name.length > 40) throw new GameError("שם הקבוצה צריך להיות בין 2 ל-40 תווים.");
  const electionStart = patch.electionStart ?? group.electionStart;
  if (Number.isNaN(Date.parse(electionStart))) throw new GameError("שעת פתיחת הקלפיות לא תקינה.");
  await db.run(
    `UPDATE groups SET name = ?, deadline = ?, election_start = ?, public_board = ? WHERE id = ?`,
    [
      name,
      patch.deadline === undefined ? group.deadline : patch.deadline,
      electionStart,
      patch.publicBoard == null ? (group.publicBoard ? 1 : 0) : patch.publicBoard ? 1 : 0,
      groupId,
    ],
  );
  await touchBoard(db);
}

export async function updateGroupAsAdmin(
  db: Db,
  groupId: string,
  token: string | null,
  patch: {
    name?: string;
    deadline?: string | null;
    electionStart?: string;
    publicBoard?: boolean;
  },
) {
  if (!(await isGroupAdmin(db, groupId, token))) {
    throw new GameError("נדרש קישור הניהול של הקבוצה.");
  }
  await updateGroup(db, groupId, patch);
}

export async function getSite(db: Db): Promise<SiteSettings> {
  const row = await db.get<{
    knesset_number: number;
    prefer_computed_seats: number;
    results_override: number;
    last_fetch_attempt_at: string | null;
    last_fetch_error: string | null;
  }>(`SELECT * FROM site WHERE id = 'site'`);
  if (!row) throw new GameError("הגדרות האתר לא נמצאו.");
  return {
    knessetNumber: Number(row.knesset_number) || 26,
    preferComputed: Number(row.prefer_computed_seats) === 1,
    resultsOverride: Number(row.results_override) === 1,
    lastFetchAttemptAt: row.last_fetch_attempt_at,
    fetchError: row.last_fetch_error,
  };
}

export async function updateSite(
  db: Db,
  patch: { knessetNumber?: number; preferComputed?: boolean },
) {
  const site = await getSite(db);
  const knesset = patch.knessetNumber ?? site.knessetNumber;
  if (!Number.isInteger(knesset) || knesset < 20 || knesset > 40) {
    throw new GameError("מספר הכנסת לא נראה נכון.");
  }
  await db.run(`UPDATE site SET knesset_number = ?, prefer_computed_seats = ? WHERE id = 'site'`, [
    knesset,
    patch.preferComputed == null ? (site.preferComputed ? 1 : 0) : patch.preferComputed ? 1 : 0,
  ]);
  if (patch.preferComputed != null) await recomputeCurrent(db);
}

export async function isGroupAdmin(db: Db, groupId: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const row = await db.get<{ admin_token_hash: string | null }>(
    `SELECT admin_token_hash FROM groups WHERE id = ?`,
    [groupId],
  );
  if (!row?.admin_token_hash) return false;
  return safeEqual(row.admin_token_hash, hashToken(token));
}

export async function rotateGroupAdmin(db: Db, groupId: string) {
  const group = await mustGroup(db, groupId);
  const adminToken = newToken();
  await db.run(`UPDATE groups SET admin_token_hash = ? WHERE id = ?`, [hashToken(adminToken), groupId]);
  return { code: group.code, adminToken };
}

export async function listParties(db: Db): Promise<Party[]> {
  const rows = await db.all<{
    id: string;
    name: string;
    ballot: string;
    color: string;
    sort_order: number;
    match_keys: string;
  }>(`SELECT * FROM parties ORDER BY sort_order, name`);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ballot: row.ballot,
    color: row.color,
    sortOrder: row.sort_order,
    matchKeys: parseKeys(row.match_keys),
  }));
}

export async function addParty(db: Db, input: { name: string; ballot: string; color: string; matchKeys: string[] }) {
  const name = input.name.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 80) throw new GameError("שם הרשימה צריך להיות בין 1 ל-80 תווים.");
  const parties = await listParties(db);
  const sort = parties.reduce((max, party) => Math.max(max, party.sortOrder), -1) + 1;
  await db.run(
    `INSERT INTO parties (id, name, ballot, color, sort_order, match_keys, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), name, input.ballot.trim(), cleanColor(input.color), sort, JSON.stringify(input.matchKeys), new Date().toISOString()],
  );
  await recomputeCurrent(db);
}

export async function updateParty(
  db: Db,
  partyId: string,
  input: { name: string; ballot: string; color: string; matchKeys: string[] },
) {
  const name = input.name.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 80) throw new GameError("שם הרשימה צריך להיות בין 1 ל-80 תווים.");
  const result = await db.run(
    `UPDATE parties SET name = ?, ballot = ?, color = ?, match_keys = ? WHERE id = ?`,
    [name, input.ballot.trim(), cleanColor(input.color), JSON.stringify(input.matchKeys), partyId],
  );
  if (result.changes === 0) throw new GameError("הרשימה לא נמצאה.");
  await recomputeCurrent(db);
}

export async function deleteParty(db: Db, partyId: string) {
  const used = await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM predictions WHERE party_id = ?`, [partyId]);
  if (Number(used?.c ?? 0) > 0) {
    throw new GameError("אי אפשר למחוק רשימה שכבר ניחשו עליה. אפשר לשנות שם או אותיות.");
  }
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM surplus_agreements WHERE party_a_id = ? OR party_b_id = ?`, [partyId, partyId]);
    await tx.run(`DELETE FROM parties WHERE id = ?`, [partyId]);
  });
  await recomputeCurrent(db);
}

export async function moveParty(db: Db, partyId: string, direction: -1 | 1) {
  const parties = await listParties(db);
  const index = parties.findIndex((party) => party.id === partyId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= parties.length) return;
  await db.transaction(async (tx) => {
    await tx.run(`UPDATE parties SET sort_order = ? WHERE id = ?`, [parties[target].sortOrder, parties[index].id]);
    await tx.run(`UPDATE parties SET sort_order = ? WHERE id = ?`, [parties[index].sortOrder, parties[target].id]);
  });
}

export async function listAgreements(db: Db): Promise<Agreement[]> {
  const rows = await db.all<{
    id: string;
    party_a_id: string;
    party_b_id: string;
    party_a_name: string;
    party_b_name: string;
  }>(
    `SELECT a.id AS id, a.party_a_id AS party_a_id, a.party_b_id AS party_b_id,
            pa.name AS party_a_name, pb.name AS party_b_name
     FROM surplus_agreements a
     JOIN parties pa ON pa.id = a.party_a_id
     JOIN parties pb ON pb.id = a.party_b_id
     ORDER BY pa.sort_order`,
  );
  return rows.map((row) => ({
    id: row.id,
    partyAId: row.party_a_id,
    partyBId: row.party_b_id,
    partyAName: row.party_a_name,
    partyBName: row.party_b_name,
  }));
}

export async function addAgreement(db: Db, partyAId: string, partyBId: string) {
  if (partyAId === partyBId) throw new GameError("הסכם עודפים נחתם בין שתי רשימות שונות.");
  const parties = await listParties(db);
  if (!parties.some((party) => party.id === partyAId) || !parties.some((party) => party.id === partyBId)) {
    throw new GameError("אחת הרשימות לא נמצאה.");
  }
  const existing = await listAgreements(db);
  const busy = new Set(existing.flatMap((item) => [item.partyAId, item.partyBId]));
  if (busy.has(partyAId) || busy.has(partyBId)) {
    throw new GameError("רשימה יכולה להיות רק בהסכם עודפים אחד.");
  }
  await db.run(
    `INSERT INTO surplus_agreements (id, party_a_id, party_b_id, created_at) VALUES (?, ?, ?, ?)`,
    [newId(), partyAId, partyBId, new Date().toISOString()],
  );
  await recomputeCurrent(db);
}

export async function removeAgreement(db: Db, agreementId: string) {
  await db.run(`DELETE FROM surplus_agreements WHERE id = ?`, [agreementId]);
  await recomputeCurrent(db);
}

const LOCKED_MESSAGE = "הניחושים נעולים. אי אפשר להצטרף או לשנות אחרי הנעילה.";

function assertBetsOpen(group: { electionStart: string; deadline: string | null }, now: number) {
  if (betsLocked(group.electionStart, group.deadline, now)) throw new GameError(LOCKED_MESSAGE);
}

export async function joinGroup(db: Db, groupId: string, displayName: string, now = Date.now()) {
  const alias = cleanDisplayName(displayName);
  if (!alias) throw new GameError("בחרו כינוי באורך 1 עד 24 תווים.");
  const group = await mustGroup(db, groupId);
  assertBetsOpen(group, now);
  const token = newToken();
  const id = newId();
  try {
    await db.run(
      `INSERT INTO participants (id, group_id, display_name, name_key, token_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, groupId, alias, nameKey(alias), hashToken(token), new Date().toISOString()],
    );
  } catch (error) {
    if (isUnique(error)) {
      throw new GameError("הכינוי תפוס בקבוצה הזו. בחרו אחר, או היכנסו מאותו דפדפן שבו כבר הצטרפתם.");
    }
    throw error;
  }
  return { token, participantId: id, alias };
}

export async function participantFromToken(db: Db, groupId: string, token: string | null) {
  if (!token) return null;
  return (
    (await db.get<{ id: string; display_name: string; created_at: string }>(
      `SELECT id, display_name, created_at FROM participants WHERE group_id = ? AND token_hash = ?`,
      [groupId, hashToken(token)],
    )) ?? null
  );
}

export async function savePrediction(
  db: Db,
  groupId: string,
  token: string,
  rawSeats: Record<string, unknown>,
  now = Date.now(),
) {
  const participant = await participantFromToken(db, groupId, token);
  if (!participant) throw new GameError("לא מצאנו ניחוש שמור בדפדפן הזה. הצטרפו עם כינוי.");
  const group = await mustGroup(db, groupId);
  assertBetsOpen(group, now);
  const parties = await listParties(db);
  const known = new Set(parties.map((party) => party.id));
  for (const key of Object.keys(rawSeats)) {
    if (!known.has(key)) throw new GameError("הטופס כולל רשימה שלא קיימת.");
  }
  const seats: Record<string, number> = {};
  for (const party of parties) {
    const value = rawSeats[party.id] ?? 0;
    const number = typeof value === "number" ? value : Number(value);
    seats[party.id] = number;
  }
  const check = checkSeatVector(parties.map((party) => seats[party.id]));
  if (!check.ok) throw new GameError(check.error);
  const savedAt = new Date(now).toISOString();
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM predictions WHERE participant_id = ?`, [participant.id]);
    for (const party of parties) {
      await tx.run(
        `INSERT INTO predictions (participant_id, party_id, seats, updated_at) VALUES (?, ?, ?, ?)`,
        [participant.id, party.id, seats[party.id], savedAt],
      );
    }
  });
  await touchBoard(db);
  return { warnings: check.warnings };
}

export async function deleteParticipation(db: Db, groupId: string, token: string, now = Date.now()) {
  const participant = await participantFromToken(db, groupId, token);
  if (!participant) throw new GameError("לא מצאנו משתתף בדפדפן הזה.");
  const group = await mustGroup(db, groupId);
  assertBetsOpen(group, now);
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM predictions WHERE participant_id = ?`, [participant.id]);
    await tx.run(`DELETE FROM participants WHERE id = ?`, [participant.id]);
  });
  await touchBoard(db);
}

export async function listParticipantsAdmin(db: Db, groupId: string): Promise<AdminParticipant[]> {
  const rows = await db.all<{ display_name: string; created_at: string; seat_sum: number | string }>(
    `SELECT p.display_name, p.created_at,
            COALESCE((SELECT SUM(pr.seats) FROM predictions pr WHERE pr.participant_id = p.id), 0) AS seat_sum
     FROM participants p
     WHERE p.group_id = ?
     ORDER BY p.created_at`,
    [groupId],
  );
  return rows.map((row) => ({
    alias: row.display_name,
    joinedAt: row.created_at,
    complete: Number(row.seat_sum) === KNESSET_SEATS,
  }));
}

export async function applyParsedResults(
  db: Db,
  parsed: ParsedResults,
  meta: {
    source: "official" | "upload" | "manual";
    sourceUrl?: string | null;
    fetchedAt?: string;
    preferComputed?: boolean;
  },
) {
  const site = await getSite(db);
  const parties = await listParties(db);
  const agreements = await listAgreements(db);
  const decision = decideSeats({
    parsed,
    parties: parties.map(toRef),
    agreements: agreements.map((item) => ({ a: item.partyAId, b: item.partyBId })),
    preferComputed: meta.preferComputed ?? site.preferComputed,
  });
  await replaceSnapshot(db, {
    fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
    status: parsed.status,
    source: meta.source,
    seatMethod: decision.method,
    sourceUrl: meta.sourceUrl ?? null,
    countedPercent: parsed.countedPercent,
    turnoutPercent: parsed.turnoutPercent,
    eligibleVoters: parsed.eligibleVoters,
    ballotsCast: parsed.ballotsCast,
    validVotes: parsed.validVotes,
    invalidVotes: parsed.invalidVotes,
    scoreable: decision.scoreable,
    note: decision.warnings.length ? decision.warnings.join("\n") : null,
    rows: decision.rows,
  });
  return decision;
}

export async function saveManualResults(
  db: Db,
  input: {
    seatsByPartyId: Record<string, number>;
    votesByPartyId: Record<string, number | null>;
    computeFromVotes: boolean;
    status: "provisional" | "final";
    countedPercent: number | null;
    turnoutPercent: number | null;
  },
) {
  const parties = await listParties(db);
  if (input.computeFromVotes) {
    for (const party of parties) {
      const votes = input.votesByPartyId[party.id];
      if (votes == null || !Number.isInteger(votes) || votes < 0) {
        throw new GameError(`חסרות קולות תקינים עבור ${party.name}.`);
      }
    }
    const lists: ParsedList[] = parties.map((party) => ({
      name: party.name,
      ballot: party.ballot,
      votes: input.votesByPartyId[party.id],
      officialSeats: null,
      votePercent: null,
    }));
    const validVotes = lists.reduce((sum, list) => sum + (list.votes ?? 0), 0);
    await applyParsedResults(
      db,
      {
        status: input.status,
        countedPercent: input.countedPercent,
        turnoutPercent: input.turnoutPercent,
        eligibleVoters: null,
        ballotsCast: null,
        validVotes,
        invalidVotes: null,
        lists,
        format: "manual-votes",
      },
      { source: "manual", preferComputed: true },
    );
  } else {
    const seats = parties.map((party) => input.seatsByPartyId[party.id] ?? 0);
    const check = checkSeatVector(seats);
    if (!check.ok) throw new GameError(check.error);
    for (const party of parties) {
      const votes = input.votesByPartyId[party.id];
      if (votes != null && (!Number.isInteger(votes) || votes < 0)) {
        throw new GameError(`קולות לא תקינים עבור ${party.name}.`);
      }
    }
    await replaceSnapshot(db, {
      fetchedAt: new Date().toISOString(),
      status: input.status,
      source: "manual",
      seatMethod: "manual",
      sourceUrl: null,
      countedPercent: input.countedPercent,
      turnoutPercent: input.turnoutPercent,
      eligibleVoters: null,
      ballotsCast: null,
      validVotes: null,
      invalidVotes: null,
      scoreable: true,
      note: "הזנה ידנית של מנדטים.",
      rows: parties.map((party) => ({
        partyId: party.id,
        sourceName: party.name,
        sourceBallot: party.ballot,
        votes: input.votesByPartyId[party.id],
        officialSeats: input.seatsByPartyId[party.id] ?? 0,
        seats: input.seatsByPartyId[party.id] ?? 0,
        passedThreshold: (input.seatsByPartyId[party.id] ?? 0) > 0,
        mapped: true,
      })),
    });
  }
  await db.run(`UPDATE site SET results_override = 1, last_fetch_error = NULL WHERE id = 'site'`);
}

export async function markUploaded(db: Db) {
  await db.run(`UPDATE site SET results_override = 1, last_fetch_error = NULL WHERE id = 'site'`);
}

export async function clearOverride(db: Db) {
  await db.run(`UPDATE site SET results_override = 0 WHERE id = 'site'`);
}

export async function recomputeCurrent(db: Db) {
  const snapshot = await currentSnapshot(db);
  if (!snapshot || snapshot.seat_method === "manual") return;
  const stored = await snapshotRows(db, snapshot.id);
  const parsed: ParsedResults = {
    status: snapshot.status,
    countedPercent: numberOrNull(snapshot.counted_percent),
    turnoutPercent: numberOrNull(snapshot.turnout_percent),
    eligibleVoters: numberOrNull(snapshot.eligible_voters),
    ballotsCast: numberOrNull(snapshot.ballots_cast),
    validVotes: numberOrNull(snapshot.valid_votes),
    invalidVotes: numberOrNull(snapshot.invalid_votes),
    lists: stored.map((row) => ({
      name: row.source_name,
      ballot: row.source_ballot,
      votes: numberOrNull(row.votes),
      officialSeats: numberOrNull(row.official_seats),
      votePercent: null,
    })),
    format: "recompute",
  };
  await applyParsedResults(db, parsed, {
    source: snapshot.source,
    sourceUrl: snapshot.source_url,
    fetchedAt: snapshot.fetched_at,
  });
}

export type ScoreContext = {
  site: SiteSettings;
  parties: Party[];
  actual: Record<string, number>;
  results: PublicResults | null;
  scoreable: boolean;
};

export async function loadScoreContext(db: Db): Promise<ScoreContext> {
  const site = await getSite(db);
  const parties = await listParties(db);
  const snapshot = await currentSnapshot(db);
  const resultRows = snapshot ? await snapshotRows(db, snapshot.id) : [];
  const actual: Record<string, number> = {};
  for (const party of parties) actual[party.id] = 0;
  for (const row of resultRows) {
    if (row.party_id) actual[row.party_id] = (actual[row.party_id] ?? 0) + Number(row.seats);
  }
  const scoreable = Boolean(snapshot && Number(snapshot.scoreable) === 1);
  const results: PublicResults | null = snapshot
    ? {
        status: snapshot.status,
        source: snapshot.source,
        seatMethod: snapshot.seat_method,
        countedPercent: numberOrNull(snapshot.counted_percent),
        turnoutPercent: numberOrNull(snapshot.turnout_percent),
        fetchedAt: snapshot.fetched_at,
        scoreable,
        note: snapshot.note,
        parties: parties.map((party) => {
          const row = resultRows.find((item) => item.party_id === party.id);
          return {
            name: party.name,
            ballot: party.ballot,
            color: party.color,
            seats: actual[party.id] ?? 0,
            votes: row ? numberOrNull(row.votes) : null,
            passed: row ? Number(row.passed_threshold) === 1 : false,
          };
        }),
        unmapped: resultRows
          .filter((row) => !row.party_id || Number(row.mapped) === 0)
          .map((row) => ({
            name: row.source_name,
            ballot: row.source_ballot,
            seats: Number(row.seats),
            votes: numberOrNull(row.votes),
          })),
      }
    : null;
  return { site, parties, actual, results, scoreable };
}

export async function getPublicState(db: Db, groupId: string, token: string | null): Promise<PublicGroupState> {
  const group = await mustGroup(db, groupId);
  const { site, parties, actual, results, scoreable } = await loadScoreContext(db);
  const participants = await db.all<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM participants WHERE group_id = ? ORDER BY created_at`,
    [groupId],
  );
  const you = await participantFromToken(db, groupId, token);
  const predictionRows = await db.all<{ participant_id: string; party_id: string; seats: number }>(
    `SELECT participant_id, party_id, seats FROM predictions
     WHERE participant_id IN (SELECT id FROM participants WHERE group_id = ?)`,
    [groupId],
  );
  const byParticipant = new Map<string, Record<string, number>>();
  for (const row of predictionRows) {
    const bag = byParticipant.get(row.participant_id) ?? {};
    bag[row.party_id] = Number(row.seats);
    byParticipant.set(row.participant_id, bag);
  }

  const completeIds = new Set(
    participants
      .filter((participant) => {
        const predicted = byParticipant.get(participant.id) ?? {};
        return checkSeatVector(parties.map((party) => predicted[party.id] ?? 0)).ok;
      })
      .map((participant) => participant.id),
  );

  const internal = scoreable
    ? buildStandings(
        parties.map((party) => party.id),
        actual,
        participants
          .filter((participant) => completeIds.has(participant.id))
          .map((participant) => ({
            id: participant.id,
            alias: participant.display_name,
            predicted: byParticipant.get(participant.id) ?? {},
          })),
      )
    : [];

  const partyById = new Map(parties.map((party) => [party.id, party]));
  const schedule = lockSchedule(group.electionStart, group.deadline);
  const locked = isLocked(schedule.lockAt);
  let own: OwnView | null = null;
  if (you) {
    const predicted = byParticipant.get(you.id) ?? {};
    const total = parties.reduce((sum, party) => sum + (predicted[party.id] ?? 0), 0);
    const submitted = completeIds.has(you.id);
    const mine = internal.find((row) => row.participantId === you.id);
    own = {
      alias: you.display_name,
      submitted,
      locked,
      total,
      prediction: parties.map((party) => ({
        partyId: party.id,
        name: party.name,
        ballot: party.ballot,
        color: party.color,
        seats: predicted[party.id] ?? 0,
      })),
      breakdown:
        mine == null
          ? null
          : {
              rank: mine.rank,
              absoluteRank: mine.absoluteRank,
              euclidean: roundScore(mine.euclidean),
              absolute: mine.absolute,
              parties: mine.diffs.map((diff) => ({
                partyId: diff.partyId,
                name: partyById.get(diff.partyId)?.name ?? "",
                color: partyById.get(diff.partyId)?.color ?? "#78716c",
                predicted: diff.predicted,
                actual: diff.actual,
                diff: diff.diff,
              })),
            },
    };
  }

  return {
    group: {
      name: group.name,
      code: group.code,
      deadline: group.deadline,
      electionStart: group.electionStart,
      lockAt: schedule.lockAt,
      lockReason: schedule.reason,
      locked,
      knessetNumber: site.knessetNumber,
    },
    participantCount: participants.length,
    completeCount: completeIds.size,
    aliases: participants.map((participant) => participant.display_name),
    fetchProblem: site.fetchError,
    results,
    standings: toPublicStandings(internal, you?.id),
    own,
  };
}

async function replaceSnapshot(
  db: Db,
  snapshot: {
    fetchedAt: string;
    status: "provisional" | "final";
    source: "official" | "upload" | "manual";
    seatMethod: PublicResults["seatMethod"];
    sourceUrl: string | null;
    countedPercent: number | null;
    turnoutPercent: number | null;
    eligibleVoters: number | null;
    ballotsCast: number | null;
    validVotes: number | null;
    invalidVotes: number | null;
    scoreable: boolean;
    note: string | null;
    rows: {
      partyId: string | null;
      sourceName: string;
      sourceBallot: string;
      votes: number | null;
      officialSeats: number | null;
      seats: number;
      passedThreshold: boolean;
      mapped: boolean;
    }[];
  },
) {
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM result_rows`);
    await tx.run(`DELETE FROM result_snapshots`);
    const id = newId();
    await tx.run(
      `INSERT INTO result_snapshots (
         id, fetched_at, status, source, seat_method, source_url,
         counted_percent, turnout_percent, eligible_voters, ballots_cast, valid_votes, invalid_votes,
         is_current, scoreable, note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        snapshot.fetchedAt,
        snapshot.status,
        snapshot.source,
        snapshot.seatMethod,
        snapshot.sourceUrl,
        snapshot.countedPercent,
        snapshot.turnoutPercent,
        snapshot.eligibleVoters,
        snapshot.ballotsCast,
        snapshot.validVotes,
        snapshot.invalidVotes,
        snapshot.scoreable ? 1 : 0,
        snapshot.note,
      ],
    );
    for (const row of snapshot.rows) {
      await tx.run(
        `INSERT INTO result_rows (
           id, snapshot_id, party_id, source_name, source_ballot, votes, official_seats, seats, passed_threshold, mapped
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          id,
          row.partyId,
          row.sourceName,
          row.sourceBallot,
          row.votes,
          row.officialSeats,
          row.seats,
          row.passedThreshold ? 1 : 0,
          row.mapped ? 1 : 0,
        ],
      );
    }
    await tx.run(`UPDATE site SET board_revision = board_revision + 1 WHERE id = 'site'`);
  });
}

async function currentSnapshot(db: Db) {
  return (
    (await db.get<SnapshotRow>(`SELECT * FROM result_snapshots ORDER BY fetched_at DESC LIMIT 1`)) ?? null
  );
}

async function snapshotRows(db: Db, snapshotId: string) {
  return db.all<ResultRow>(`SELECT * FROM result_rows WHERE snapshot_id = ?`, [snapshotId]);
}

async function mustGroup(db: Db, groupId: string) {
  const group = await getGroupById(db, groupId);
  if (!group) throw new GameError("הקבוצה לא נמצאה.");
  return group;
}

async function touchBoard(db: Db) {
  await db.run(`UPDATE site SET board_revision = board_revision + 1 WHERE id = 'site'`);
}

export type Group = {
  id: string;
  name: string;
  code: string;
  deadline: string | null;
  electionStart: string;
  publicBoard: boolean;
  createdAt: string;
  hasAdminLink: boolean;
};

function presentGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    deadline: row.deadline,
    electionStart: row.election_start || pollsOpenIso(),
    publicBoard: Number(row.public_board) === 1,
    createdAt: row.created_at,
    hasAdminLink: Boolean(row.admin_token_hash),
  };
}

function toRef(party: Party): PartyRef {
  return { id: party.id, name: party.name, ballot: party.ballot, matchKeys: party.matchKeys };
}

function parseKeys(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function cleanColor(input: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(input.trim()) ? input.trim() : "#1d4e89";
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isUnique(error: unknown): boolean {
  return error instanceof Error && /unique/i.test(error.message);
}
