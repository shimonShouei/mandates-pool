import type { Db } from "./db";
import { newId } from "./ids";
import { SEED_PARTIES } from "./parties";
import { pollsOpenIso } from "./time";

async function hasColumn(db: Db, table: string, column: string): Promise<boolean> {
  try {
    await db.get(`SELECT ${column} AS c FROM ${table} LIMIT 0`);
    return true;
  } catch {
    return false;
  }
}

async function addColumn(db: Db, sql: string) {
  try {
    await db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column|already exists/i.test(message)) throw error;
  }
}

function norm(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFKC")
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Move per-group parties, agreements, and results onto one shared site record. */
export async function migrateLegacySite(db: Db): Promise<void> {
  await addColumn(db, `ALTER TABLE groups ADD COLUMN election_start TEXT`);
  await addColumn(db, `ALTER TABLE groups ADD COLUMN public_board INTEGER NOT NULL DEFAULT 1`);
  await addColumn(db, `ALTER TABLE groups ADD COLUMN admin_token_hash TEXT`);
  await db.run(`UPDATE groups SET election_start = ? WHERE election_start IS NULL`, [pollsOpenIso()]);
  await db.run(`UPDATE groups SET public_board = 1 WHERE public_board IS NULL`);
  await addColumn(db, `ALTER TABLE site ADD COLUMN board_revision INTEGER NOT NULL DEFAULT 0`);
  await addColumn(db, `ALTER TABLE site ADD COLUMN threshold_bonus REAL NOT NULL DEFAULT 0.25`);
  await addColumn(db, `ALTER TABLE site ADD COLUMN crowd_min_bets INTEGER NOT NULL DEFAULT 5`);
  await addColumn(db, `ALTER TABLE site ADD COLUMN crowd_before_lock INTEGER NOT NULL DEFAULT 1`);
  await addColumn(db, `ALTER TABLE groups ADD COLUMN stake_agorot INTEGER NOT NULL DEFAULT 0`);
  await addColumn(db, `ALTER TABLE groups ADD COLUMN payout_split TEXT NOT NULL DEFAULT '100'`);
  await addColumn(db, `ALTER TABLE participants ADD COLUMN paid INTEGER NOT NULL DEFAULT 0`);
  await addColumn(db, `ALTER TABLE participants ADD COLUMN user_id TEXT`);
  await addColumn(db, `ALTER TABLE groups ADD COLUMN owner_user_id TEXT`);
  await db.run(`UPDATE groups SET payout_split = '100' WHERE payout_split IS NULL OR payout_split = ''`);
  await db.run(`UPDATE groups SET stake_agorot = 0 WHERE stake_agorot IS NULL`);
  await db.run(`UPDATE participants SET paid = 0 WHERE paid IS NULL`);

  if (await hasColumn(db, "parties", "group_id")) {
    await hoistParties(db);
  }
  if (await hasColumn(db, "surplus_agreements", "group_id")) {
    await hoistAgreements(db);
  }
  if (await hasColumn(db, "result_snapshots", "group_id")) {
    await hoistSnapshots(db);
  }

  const site = await db.get<{ id: string }>(`SELECT id FROM site WHERE id = 'site'`);
  if (!site) {
    const donor = await db.get<{
      knesset_number?: number;
      prefer_computed_seats?: number;
      results_override?: number;
      last_fetch_attempt_at?: string | null;
      last_fetch_error?: string | null;
    }>(
      `SELECT knesset_number, prefer_computed_seats, results_override, last_fetch_attempt_at, last_fetch_error
       FROM groups ORDER BY results_override DESC, created_at LIMIT 1`,
    ).catch(() => undefined);
    await db.run(
      `INSERT INTO site (id, knesset_number, prefer_computed_seats, results_override, last_fetch_attempt_at, last_fetch_error)
       VALUES ('site', ?, ?, ?, ?, ?)`,
      [
        Number(donor?.knesset_number) || 26,
        Number(donor?.prefer_computed_seats) === 1 ? 1 : 0,
        Number(donor?.results_override) === 1 ? 1 : 0,
        donor?.last_fetch_attempt_at ?? null,
        donor?.last_fetch_error ?? null,
      ],
    );
  }

  const count = await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM parties`);
  if (Number(count?.c ?? 0) === 0) {
    const now = new Date().toISOString();
    for (const [index, party] of SEED_PARTIES.entries()) {
      await db.run(
        `INSERT INTO parties (id, name, ballot, color, sort_order, match_keys, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId(), party.name, party.ballot, party.color, index, JSON.stringify(party.matchKeys), now],
      );
    }
  }
}

async function hoistParties(db: Db) {
  const parties = await db.all<{
    id: string;
    group_id: string;
    name: string;
    ballot: string;
    color: string;
    sort_order: number;
    match_keys: string;
    created_at: string;
  }>(`SELECT id, group_id, name, ballot, color, sort_order, match_keys, created_at FROM parties`);
  const groups = await db.all<{ id: string; results_override: number; created_at: string }>(
    `SELECT id, results_override, created_at FROM groups ORDER BY results_override DESC, created_at`,
  );
  const canonicalGroup = groups[0]?.id;
  const canonical = parties.filter((party) => party.group_id === canonicalGroup);
  const kept = canonical.length > 0 ? canonical : parties;
  const byBallot = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const party of kept) {
    if (norm(party.ballot)) byBallot.set(norm(party.ballot), party.id);
    if (norm(party.name)) byName.set(norm(party.name), party.id);
  }
  const map = new Map<string, string>();
  for (const party of parties) {
    const target = (norm(party.ballot) && byBallot.get(norm(party.ballot))) || byName.get(norm(party.name)) || party.id;
    map.set(party.id, target);
  }

  const predictions = await db.all<{ participant_id: string; party_id: string; seats: number; updated_at: string }>(
    `SELECT participant_id, party_id, seats, updated_at FROM predictions`,
  );
  await db.run(`DELETE FROM predictions`);
  const seen = new Set<string>();
  for (const row of predictions) {
    const partyId = map.get(row.party_id);
    if (!partyId) continue;
    const key = `${row.participant_id}:${partyId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await db.run(
      `INSERT INTO predictions (participant_id, party_id, seats, updated_at) VALUES (?, ?, ?, ?)`,
      [row.participant_id, partyId, row.seats, row.updated_at],
    );
  }

  const rows = await db.all<{ id: string; party_id: string | null }>(`SELECT id, party_id FROM result_rows`);
  for (const row of rows) {
    if (!row.party_id) continue;
    const next = map.get(row.party_id);
    if (next && next !== row.party_id) {
      await db.run(`UPDATE result_rows SET party_id = ? WHERE id = ?`, [next, row.id]);
    }
  }

  if (await hasColumn(db, "surplus_agreements", "party_a_id")) {
    const agreements = await db.all<{ id: string; party_a_id: string; party_b_id: string }>(
      `SELECT id, party_a_id, party_b_id FROM surplus_agreements`,
    );
    for (const agreement of agreements) {
      const a = map.get(agreement.party_a_id);
      const b = map.get(agreement.party_b_id);
      if (!a || !b || a === b) {
        await db.run(`DELETE FROM surplus_agreements WHERE id = ?`, [agreement.id]);
        continue;
      }
      await db.run(`UPDATE surplus_agreements SET party_a_id = ?, party_b_id = ? WHERE id = ?`, [a, b, agreement.id]);
    }
  }

  await db.exec(
    `CREATE TABLE parties_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ballot TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      match_keys TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    )`,
  );
  for (const party of kept) {
    await db.run(
      `INSERT INTO parties_v2 (id, name, ballot, color, sort_order, match_keys, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [party.id, party.name, party.ballot, party.color, party.sort_order, party.match_keys, party.created_at],
    );
  }
  await db.exec(`DROP TABLE parties`);
  await db.exec(`ALTER TABLE parties_v2 RENAME TO parties`);
}

async function hoistAgreements(db: Db) {
  const rows = await db.all<{ id: string; party_a_id: string; party_b_id: string; created_at: string }>(
    `SELECT id, party_a_id, party_b_id, created_at FROM surplus_agreements`,
  );
  await db.exec(
    `CREATE TABLE surplus_agreements_v2 (
      id TEXT PRIMARY KEY,
      party_a_id TEXT NOT NULL,
      party_b_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );
  const seen = new Set<string>();
  for (const row of rows) {
    const key = [row.party_a_id, row.party_b_id].sort().join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    await db.run(
      `INSERT INTO surplus_agreements_v2 (id, party_a_id, party_b_id, created_at) VALUES (?, ?, ?, ?)`,
      [row.id, row.party_a_id, row.party_b_id, row.created_at],
    );
  }
  await db.exec(`DROP TABLE surplus_agreements`);
  await db.exec(`ALTER TABLE surplus_agreements_v2 RENAME TO surplus_agreements`);
}

async function hoistSnapshots(db: Db) {
  const snapshots = await db.all<{
    id: string;
    group_id: string;
    fetched_at: string;
    status: string;
    source: string;
    seat_method: string;
    source_url: string | null;
    counted_percent: number | null;
    turnout_percent: number | null;
    eligible_voters: number | null;
    ballots_cast: number | null;
    valid_votes: number | null;
    invalid_votes: number | null;
    is_current: number;
    scoreable: number;
    note: string | null;
  }>(`SELECT * FROM result_snapshots ORDER BY fetched_at DESC`);
  const donor = await db
    .get<{ id: string }>(`SELECT id FROM groups WHERE results_override = 1 ORDER BY created_at LIMIT 1`)
    .catch(() => undefined);
  const chosen = snapshots.find((row) => row.group_id === donor?.id) ?? snapshots[0];
  await db.exec(
    `CREATE TABLE result_snapshots_v2 (
      id TEXT PRIMARY KEY,
      fetched_at TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      seat_method TEXT NOT NULL,
      source_url TEXT,
      counted_percent REAL,
      turnout_percent REAL,
      eligible_voters INTEGER,
      ballots_cast INTEGER,
      valid_votes INTEGER,
      invalid_votes INTEGER,
      is_current INTEGER NOT NULL DEFAULT 1,
      scoreable INTEGER NOT NULL DEFAULT 0,
      note TEXT
    )`,
  );
  if (chosen) {
    await db.run(
      `INSERT INTO result_snapshots_v2 (
         id, fetched_at, status, source, seat_method, source_url, counted_percent, turnout_percent,
         eligible_voters, ballots_cast, valid_votes, invalid_votes, is_current, scoreable, note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        chosen.id,
        chosen.fetched_at,
        chosen.status,
        chosen.source,
        chosen.seat_method,
        chosen.source_url,
        chosen.counted_percent,
        chosen.turnout_percent,
        chosen.eligible_voters,
        chosen.ballots_cast,
        chosen.valid_votes,
        chosen.invalid_votes,
        chosen.scoreable,
        chosen.note,
      ],
    );
    const drop = snapshots.filter((row) => row.id !== chosen.id).map((row) => row.id);
    for (const id of drop) {
      await db.run(`DELETE FROM result_rows WHERE snapshot_id = ?`, [id]);
    }
  }
  await db.exec(`DROP TABLE result_snapshots`);
  await db.exec(`ALTER TABLE result_snapshots_v2 RENAME TO result_snapshots`);
}
