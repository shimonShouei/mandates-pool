import { describe, expect, it } from "vitest";
import { createSqliteDb, type Db } from "./db";
import { seedElectionCatalog } from "./election-seed";
import {
  addAgreement,
  applyParsedResults,
  createGroup,
  getPublicState,
  joinGroup,
  listAgreements,
  listCatalog,
  listParties,
  removeAgreement,
  savePrediction,
  updateParty,
} from "./game";
import { MINOR_LISTS, SEED_PARTIES, SEED_SURPLUS_AGREEMENTS, WITHDRAWN_LISTS } from "./parties";
import type { ParsedList } from "./results/parse-cec";
import { pollsOpenIso } from "./time";

const OPEN = pollsOpenIso("2099-01-01");

function pair(a: string, b: string) {
  return [a, b].sort().join("|");
}

async function memory() {
  return createSqliteDb(":memory:");
}

async function agreementPairs(db: Db) {
  const rows = await db.all<{ a: string; b: string }>(
    `SELECT pa.ballot AS a, pb.ballot AS b
     FROM surplus_agreements s
     JOIN parties pa ON pa.id = s.party_a_id
     JOIN parties pb ON pb.id = s.party_b_id`,
  );
  return new Set(rows.map((row) => pair(row.a, row.b)));
}

const SIGNED = [
  pair("מחל", "ט"),
  pair("רק", "ל"),
  pair("דרך", "אמת"),
  pair("שס", "ג"),
  pair("עם", "ודם"),
];

function slip(parties: { id: string }[], amounts: number[]) {
  const seats: Record<string, number> = {};
  parties.forEach((party, index) => {
    seats[party.id] = amounts[index] ?? 0;
  });
  return seats;
}

describe("2026 lists and surplus agreements", () => {
  it("keeps 13 bet lists, 23 minor lists, and the five signed pairs", async () => {
    expect(SEED_PARTIES).toHaveLength(13);
    expect(MINOR_LISTS).toHaveLength(23);
    expect(WITHDRAWN_LISTS.map((list) => list.ballot).sort()).toEqual(["כן", "צבי"].sort());
    expect(SEED_SURPLUS_AGREEMENTS).toHaveLength(5);

    const db = await memory();
    const bets = await listParties(db);
    const catalog = await listCatalog(db);
    expect(bets).toHaveLength(13);
    expect(catalog).toHaveLength(36);
    expect(bets.map((party) => party.ballot)).not.toContain("בד");
    expect(catalog.find((party) => party.ballot === "בד")?.bettable).toBe(false);
    expect(catalog.some((party) => party.ballot === "כן" || party.ballot === "צבי")).toBe(false);
    expect(await agreementPairs(db)).toEqual(new Set(SIGNED));

    await seedElectionCatalog(db);
    expect(await listCatalog(db)).toHaveLength(36);
    expect(await agreementPairs(db)).toEqual(new Set(SIGNED));
  });

  it("does not rename a list, restore a removed agreement, or drop an agreement an admin added", async () => {
    const db = await memory();
    const likud = (await listParties(db)).find((party) => party.ballot === "מחל");
    if (!likud) throw new Error("missing likud");
    await updateParty(db, likud.id, {
      name: "הליכוד שלנו",
      ballot: likud.ballot,
      color: likud.color,
      matchKeys: likud.matchKeys,
    });
    const signed = await listAgreements(db);
    const likudDeal = signed.find((item) => item.partyAId === likud.id || item.partyBId === likud.id);
    if (!likudDeal) throw new Error("missing likud agreement");
    await removeAgreement(db, likudDeal.id);

    const bets = await listParties(db);
    const otzma = bets.find((party) => party.ballot === "ב");
    const amcha = bets.find((party) => party.ballot === "ך");
    if (!otzma || !amcha) throw new Error("missing unpaired lists");
    await addAgreement(db, otzma.id, amcha.id);

    const group = await createGroup(db, "נשמר", null, OPEN);
    const person = await joinGroup(db, group.id, "נועה");
    await savePrediction(db, group.id, person.token, slip(bets, [120]));

    await seedElectionCatalog(db);

    expect((await listParties(db)).find((party) => party.id === likud.id)?.name).toBe("הליכוד שלנו");
    const pairs = await agreementPairs(db);
    expect(pairs.has(pair("מחל", "ט"))).toBe(false);
    expect(pairs.has(pair("ב", "ך"))).toBe(true);
    expect(pairs.has(pair("רק", "ל"))).toBe(true);
    const state = await getPublicState(db, group.id, person.token);
    expect(state.own?.total).toBe(120);
    expect(state.own?.prediction.find((row) => row.ballot === "מחל")?.seats).toBe(120);
  });
});

describe("2026 results with minor lists", () => {
  it("counts minor votes, ignores withdrawn lists, and leaves a minor under the threshold at 0 seats", async () => {
    const db = await memory();
    const catalog = await listCatalog(db);
    const byBallot = new Map(catalog.map((party) => [party.ballot, party]));
    const row = (ballot: string, votes: number): ParsedList => {
      const party = byBallot.get(ballot);
      if (!party) throw new Error(ballot);
      return { name: party.name, ballot, votes, officialSeats: null, votePercent: null };
    };
    const decision = await applyParsedResults(
      db,
      {
        status: "provisional",
        countedPercent: 80,
        turnoutPercent: 60,
        eligibleVoters: null,
        ballotsCast: null,
        validVotes: null,
        invalidVotes: null,
        format: "2026-partial",
        lists: [
          row("מחל", 36_000),
          row("ט", 1_400),
          row("די", 1_300),
          row("בד", 1_000),
          row("בי", 300),
          { name: "כחול לבן בראשות בני גנץ", ballot: "כן", votes: 8_000, officialSeats: null, votePercent: null },
          { name: "תנועת אחי", ballot: "צבי", votes: 2_000, officialSeats: null, votePercent: null },
        ],
      },
      { source: "upload" },
    );

    expect(decision.scoreable).toBe(true);
    expect(decision.rows.some((item) => item.sourceBallot === "כן" || item.sourceBallot === "צבי")).toBe(false);
    expect(decision.rows.find((item) => item.sourceBallot === "בד")).toMatchObject({ mapped: true, seats: 0, passedThreshold: false });
    expect(decision.rows.find((item) => item.sourceBallot === "בי")).toMatchObject({ seats: 0 });
    expect(decision.rows.find((item) => item.sourceBallot === "די")?.passedThreshold).toBe(true);
    expect(decision.rows.reduce((sum, item) => sum + item.seats, 0)).toBe(120);
    const state = await getPublicState(db, (await createGroup(db, "קהל", null, OPEN)).id, null);
    expect(state.results?.scoreable).toBe(true);
    expect(state.results?.unmapped).toEqual([]);
  });

  it("scores a minor list that wins seats as a guess of zero", async () => {
    const db = await memory();
    const bets = await listParties(db);
    const group = await createGroup(db, "הפתעה", null, OPEN);
    const person = await joinGroup(db, group.id, "תמר");
    const likud = bets.find((party) => party.ballot === "מחל");
    if (!likud) throw new Error("missing likud");
    const seats = slip(bets, []);
    seats[likud.id] = 120;
    await savePrediction(db, group.id, person.token, seats);

    const catalog = await listCatalog(db);
    const byBallot = new Map(catalog.map((party) => [party.ballot, party]));
    const row = (ballot: string, votes: number): ParsedList => {
      const party = byBallot.get(ballot);
      if (!party) throw new Error(ballot);
      return { name: party.name, ballot, votes, officialSeats: null, votePercent: null };
    };
    const decision = await applyParsedResults(
      db,
      {
        status: "final",
        countedPercent: 100,
        turnoutPercent: 70,
        eligibleVoters: null,
        ballotsCast: null,
        validVotes: null,
        invalidVotes: null,
        format: "2026-minor-seats",
        lists: [row("מחל", 30_000), row("ט", 2_000), row("בד", 8_000)],
      },
      { source: "upload" },
    );

    expect(decision.scoreable).toBe(true);
    expect(decision.rows.find((item) => item.sourceBallot === "בד")?.seats).toBe(24);
    const state = await getPublicState(db, group.id, person.token);
    expect(state.results?.scoreable).toBe(true);
    expect(state.results?.unmapped).toEqual([]);
    expect(state.standings[0]?.absolute).toBe(60);
    const surprise = state.own?.breakdown?.parties.find((item) => item.partyId === byBallot.get("בד")?.id);
    expect(surprise).toMatchObject({ predicted: 0, actual: 24 });
  });
});
