import type { Db } from "./db";
import { newId } from "./ids";
import { MINOR_LISTS, SEED_PARTIES, SEED_SURPLUS_AGREEMENTS, type SeedParty } from "./parties";

/** Once this row exists, a later admin edit of the agreements is left alone. */
const SURPLUS_SEED_ID = "surplus-agreements-2026";

function ballotKey(ballot: string): string {
  return ballot.normalize("NFKC").replace(/\s+/g, "").trim();
}

function pairKey(a: string, b: string): string {
  const [left, right] = [ballotKey(a), ballotKey(b)].sort();
  return `${left}\u0000${right}`;
}

/**
 * Insert competitive lists, minor lists, and the signed 2026 surplus pairs
 * when they are absent. Existing rows are not renamed or deleted, so an
 * admin edit survives the next boot. The surplus seed runs once: a pair an
 * admin removes afterwards is not put back.
 */
export async function seedElectionCatalog(db: Db): Promise<void> {
  const now = new Date().toISOString();
  await insertMissingParties(db, now);

  const seeded = await db.get<{ id: string }>(`SELECT id FROM schema_seeds WHERE id = ?`, [SURPLUS_SEED_ID]);
  if (seeded) return;

  const pending = await insertMissingAgreements(db, now);
  if (pending) return;

  const { recomputeCurrent } = await import("./game");
  await recomputeCurrent(db);
  await db.run(`INSERT INTO schema_seeds (id, applied_at) VALUES (?, ?)`, [SURPLUS_SEED_ID, now]);
}

async function insertMissingParties(db: Db, now: string) {
  const existing = await db.all<{ ballot: string }>(`SELECT ballot FROM parties`);
  const seen = new Set(existing.map((row) => ballotKey(row.ballot)));
  const maxSort = await db.get<{ m: number | null }>(`SELECT MAX(sort_order) AS m FROM parties`);
  let sort = Number(maxSort?.m ?? -1) + 1;

  const insert = async (party: SeedParty, bettable: number) => {
    const key = ballotKey(party.ballot);
    if (seen.has(key)) return;
    await db.run(
      `INSERT INTO parties (id, name, ballot, color, sort_order, match_keys, bettable, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), party.name, party.ballot, party.color, sort, JSON.stringify(party.matchKeys), bettable, now],
    );
    seen.add(key);
    sort += 1;
  };

  for (const party of SEED_PARTIES) await insert(party, 1);
  for (const party of MINOR_LISTS) await insert(party, 0);
}

/** Returns true when a signed pair could not be stored yet, so the seed stays unfinished. */
async function insertMissingAgreements(db: Db, now: string): Promise<boolean> {
  const parties = await db.all<{ id: string; ballot: string }>(`SELECT id, ballot FROM parties`);
  const byBallot = new Map(parties.map((party) => [ballotKey(party.ballot), party.id]));
  const ballotOf = new Map(parties.map((party) => [party.id, party.ballot]));
  const rows = await db.all<{ party_a_id: string; party_b_id: string }>(
    `SELECT party_a_id, party_b_id FROM surplus_agreements`,
  );
  const busy = new Set<string>();
  const paired = new Set<string>();
  for (const row of rows) {
    busy.add(row.party_a_id);
    busy.add(row.party_b_id);
    const left = ballotOf.get(row.party_a_id);
    const right = ballotOf.get(row.party_b_id);
    if (left && right) paired.add(pairKey(left, right));
  }

  let pending = false;
  for (const pair of SEED_SURPLUS_AGREEMENTS) {
    const a = byBallot.get(ballotKey(pair.a));
    const b = byBallot.get(ballotKey(pair.b));
    if (!a || !b) {
      pending = true;
      continue;
    }
    if (paired.has(pairKey(pair.a, pair.b))) continue;
    if (busy.has(a) || busy.has(b)) {
      pending = true;
      continue;
    }
    await db.run(
      `INSERT INTO surplus_agreements (id, party_a_id, party_b_id, created_at) VALUES (?, ?, ?, ?)`,
      [newId(), a, b, now],
    );
    busy.add(a);
    busy.add(b);
    paired.add(pairKey(pair.a, pair.b));
  }
  return pending;
}
