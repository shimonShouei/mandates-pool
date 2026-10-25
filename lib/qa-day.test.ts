import { describe, expect, it } from "vitest";
import { authModes } from "./auth-modes";
import { readGroupCrowd } from "./board-cache";
import { createSqliteDb } from "./db";
import {
  addParty,
  applyParsedResults,
  createGroup,
  getGroupByCode,
  getPublicState,
  joinGroup,
  listParties,
  saveManualResults,
  savePrediction,
  savePredictionForUser,
  updateGroup,
} from "./game";
import { globalLeaderboard } from "./leaderboard";
import { allocateByPercent, computeWinnings, parseStakeIls } from "./payout";
import { allocateBaderOfer } from "./results/bader-ofer";
import { fetchOfficialResults } from "./results/fetch-official";
import type { ParsedResults } from "./results/parse-cec";
import { ensureFreshSite } from "./refresh";
import { buildStandings, scoreGuess } from "./scoring";
import { cleanDisplayName } from "./ids";
import { isLocked, pollsOpenIso } from "./time";
import { createAccount } from "./accounts";

const OPEN = pollsOpenIso("2099-01-01");
const LOCK = pollsOpenIso("2026-10-27");

async function memory() {
  return createSqliteDb(":memory:");
}

function fill(parties: { id: string }[], amounts: number[]) {
  const seats: Record<string, number> = {};
  parties.forEach((party, index) => {
    seats[party.id] = amounts[index] ?? 0;
  });
  return seats;
}

function full(parties: { id: string }[], first: number, second = 0) {
  return fill(parties, [first, second, Math.max(0, 120 - first - second)]);
}

function numbersIn(value: unknown, found: number[] = []): number[] {
  if (typeof value === "number") found.push(value);
  else if (Array.isArray(value)) for (const item of value) numbersIn(item, found);
  else if (value && typeof value === "object") for (const item of Object.values(value)) numbersIn(item, found);
  return found;
}

describe("election-day bets", () => {
  it("accepts only a plain integer vector that sums to 120", async () => {
    const db = await memory();
    const group = await createGroup(db, "ניחושים", null, OPEN);
    const parties = await listParties(db);
    const person = await joinGroup(db, group.id, "נועה");
    const ok = full(parties, 32, 24);
    await savePrediction(db, group.id, person.token, ok);

    await expect(savePrediction(db, group.id, person.token, fill(parties, [119]))).rejects.toThrow(/120/);
    await expect(savePrediction(db, group.id, person.token, fill(parties, []))).rejects.toThrow(/120/);
    await expect(savePrediction(db, group.id, person.token, { ...ok, [parties[0].id]: -1, [parties[1].id]: 33 })).rejects.toThrow(/שלילי/);
    await expect(savePrediction(db, group.id, person.token, { ...ok, [parties[0].id]: 12.5 })).rejects.toThrow(/שלמים/);
    await expect(savePrediction(db, group.id, person.token, { ...ok, [parties[0].id]: "nope" })).rejects.toThrow(/שלמים/);
    await expect(savePrediction(db, group.id, person.token, { ...ok, [parties[0].id]: "0x10" })).rejects.toThrow(/שלמים/);
    await expect(savePrediction(db, group.id, person.token, { ...ok, [parties[0].id]: "1e2" })).rejects.toThrow(/שלמים/);
    await expect(savePrediction(db, group.id, person.token, { ...ok, [parties[0].id]: true })).rejects.toThrow(/שלמים/);
    await expect(savePrediction(db, group.id, person.token, { ...ok, [parties[0].id]: 121, [parties[2].id]: 0 })).rejects.toThrow(/120/);

    const omitted = { ...ok };
    delete omitted[parties[3].id];
    await savePrediction(db, group.id, person.token, omitted);
    const state = await getPublicState(db, group.id, person.token);
    expect(state.own?.prediction.find((row) => row.partyId === parties[3].id)?.seats).toBe(0);

    await expect(savePrediction(db, group.id, person.token, { ...ok, "not-a-party": 0 })).rejects.toThrow(/לא קיימת/);
  });

  it("keeps Hebrew, emoji, and hostile nicknames as text", async () => {
    const db = await memory();
    const group = await createGroup(db, "<script>alert(1)</script>", null, OPEN);
    expect(group.name).toBe("<script>alert(1)</script>");
    await expect(createGroup(db, "שורה\nשנייה", null, OPEN)).rejects.toThrow(/40/);

    const emoji = "🎈".repeat(12);
    expect(emoji.length).toBe(24);
    expect(cleanDisplayName(emoji)).toBe(emoji);
    expect(cleanDisplayName("🎈".repeat(13))).toBeNull();
    expect(cleanDisplayName("א".repeat(25))).toBeNull();

    const hebrew = await joinGroup(db, group.id, "עמית abc\u200f");
    expect(hebrew.alias).toContain("עמית");
    const marked = await joinGroup(db, group.id, emoji);
    expect(marked.alias).toBe(emoji);

    const hostile = "<svg/onload=alert(1)>";
    const injected = await joinGroup(db, group.id, hostile);
    expect(injected.alias).toBe(hostile);
    const sql = "'; DROP TABLE p;--";
    const dropped = await joinGroup(db, group.id, sql);
    expect(dropped.alias).toBe(sql);
    expect(await listParties(db)).toHaveLength(13);
    expect(await getGroupByCode(db, group.code)).not.toBeNull();

    await expect(joinGroup(db, group.id, "Noa")).resolves.toMatchObject({ alias: "Noa" });
    await expect(joinGroup(db, group.id, " noa ")).rejects.toThrow(/תפוס/);
    await expect(joinGroup(db, group.id, "NOA")).rejects.toThrow(/תפוס/);

    const state = await getPublicState(db, group.id, null);
    expect(state.group.name).toBe("<script>alert(1)</script>");
    expect(state.aliases).toContain(hostile);
    expect(state.aliases).toContain(sql);
    expect(JSON.stringify(state)).not.toContain(group.adminToken);
  });
});

describe("election-day lock", () => {
  it("closes one second before and after 07:00 Asia/Jerusalem on 27.10.2026", async () => {
    expect(LOCK).toBe("2026-10-27T05:00:00.000Z");
    const db = await memory();
    const group = await createGroup(db, "נעילה", null, LOCK);
    const parties = await listParties(db);
    const seats = full(parties, 120);
    const at = Date.parse(LOCK);
    const person = await joinGroup(db, group.id, "דנה", at - 1000);
    await savePrediction(db, group.id, person.token, seats, at - 1000);
    await expect(savePrediction(db, group.id, person.token, seats, at)).rejects.toThrow(/נעול/);
    await expect(savePrediction(db, group.id, person.token, seats, at + 1000)).rejects.toThrow(/נעול/);
    await expect(joinGroup(db, group.id, "אחר", at + 1000)).rejects.toThrow(/נעול/);

    const later = new Date(at + 60 * 60 * 1000).toISOString();
    await updateGroup(db, group.id, { deadline: later });
    await expect(savePrediction(db, group.id, person.token, seats, at + 1000)).rejects.toThrow(/נעול/);
    const state = await getPublicState(db, group.id, person.token);
    expect(state.group.lockAt).toBe(LOCK);
    expect(state.group.lockReason).toBe("election");
    expect(isLocked(state.group.lockAt, at - 1000)).toBe(false);
    expect(isLocked(state.group.lockAt, at)).toBe(true);
  });
});

describe("election-day scoring", () => {
  it("scores an exact match as zero and shares a rank only on a full tie", () => {
    const exact = scoreGuess(["a", "b"], { a: 70, b: 50 }, { a: 70, b: 50 }, 0.25);
    expect(exact).toMatchObject({ absolute: 0, misplaced: 0, score: -0.5, thresholdCorrect: 2 });
    const rows = buildStandings(
      ["a", "b"],
      { a: 10, b: 0 },
      [
        { id: "zero", alias: "אפס", predicted: { a: 0, b: 0 } },
        { id: "call", alias: "קריאה", predicted: { a: 4, b: 0 } },
      ],
      0,
    );
    expect(rows.find((row) => row.alias === "אפס")?.diffs[1]).toMatchObject({ actual: 0, passedCall: true });
    expect(rows.find((row) => row.alias === "קריאה")?.diffs[0].passedCall).toBe(true);
    expect(rows.find((row) => row.alias === "קריאה")?.diffs[1]).toMatchObject({ predicted: 0, actual: 0, passedCall: true });
  });

  it("hides the board while results are partial, then updates ranks when the night moves", async () => {
    const db = await memory();
    const group = await createGroup(db, "לילה", null, OPEN);
    const parties = await listParties(db);
    const [a, b] = parties;
    const alice = await joinGroup(db, group.id, "נועה");
    const bob = await joinGroup(db, group.id, "עידו");
    await savePrediction(db, group.id, alice.token, full(parties, 80, 40));
    await savePrediction(db, group.id, bob.token, full(parties, 40, 80));

    await applyParsedResults(
      db,
      {
        status: "provisional",
        countedPercent: 20,
        turnoutPercent: 10,
        eligibleVoters: null,
        ballotsCast: null,
        validVotes: null,
        invalidVotes: null,
        format: "partial",
        lists: [{ name: a.name, ballot: a.ballot, votes: null, officialSeats: 80, votePercent: null }],
      },
      { source: "official" },
    );
    expect((await getPublicState(db, group.id, null)).results?.scoreable).toBe(false);
    expect((await globalLeaderboard(db)).scoreable).toBe(false);
    expect((await globalLeaderboard(db)).rows).toEqual([]);

    const manual = (first: number, second: number) => {
      const seats: Record<string, number> = {};
      parties.forEach((party, index) => {
        seats[party.id] = index === 0 ? first : index === 1 ? second : 0;
      });
      return seats;
    };
    await saveManualResults(db, {
      seatsByPartyId: manual(80, 40),
      votesByPartyId: {},
      computeFromVotes: false,
      status: "provisional",
      countedPercent: 60,
      turnoutPercent: 40,
    });
    expect((await getPublicState(db, group.id, null)).standings.map((row) => row.alias)).toEqual(["נועה", "עידו"]);

    await saveManualResults(db, {
      seatsByPartyId: manual(40, 80),
      votesByPartyId: {},
      computeFromVotes: false,
      status: "provisional",
      countedPercent: 90,
      turnoutPercent: 62,
    });
    const flipped = await getPublicState(db, group.id, null);
    expect(flipped.standings.map((row) => row.alias)).toEqual(["עידו", "נועה"]);
    expect(flipped.standings[0].rank).toBe(1);
    expect(flipped.results?.parties.find((party) => party.ballot === b.ballot)?.seats).toBe(80);
  });

  it("does not rank while a new results list is unmapped, then scores a missing guess as zero", async () => {
    const db = await memory();
    const group = await createGroup(db, "רשימה חדשה", null, OPEN);
    const parties = await listParties(db);
    const person = await joinGroup(db, group.id, "תמר");
    await savePrediction(db, group.id, person.token, full(parties, 120));
    const known = parties[0];
    await applyParsedResults(
      db,
      {
        status: "provisional",
        countedPercent: 100,
        turnoutPercent: 70,
        eligibleVoters: null,
        ballotsCast: null,
        validVotes: null,
        invalidVotes: null,
        format: "with-new-list",
        lists: [
          { name: known.name, ballot: known.ballot, votes: null, officialSeats: 116, votePercent: null },
          { name: "רשימה חדשה", ballot: "חדש", votes: null, officialSeats: 4, votePercent: null },
        ],
      },
      { source: "upload" },
    );
    const waiting = await getPublicState(db, group.id, person.token);
    expect(waiting.results?.scoreable).toBe(false);
    expect(waiting.results?.unmapped.map((row) => row.ballot)).toContain("חדש");
    expect(waiting.standings).toEqual([]);

    await addParty(db, { name: "רשימה חדשה", ballot: "חדש", color: "#2255aa", matchKeys: ["חדש"] });
    const scored = await getPublicState(db, group.id, person.token);
    expect(scored.results?.scoreable).toBe(true);
    expect(scored.results?.unmapped).toEqual([]);
    const fresh = scored.own?.breakdown?.parties.find((row) => row.name === "רשימה חדשה");
    expect(fresh).toMatchObject({ predicted: 0, actual: 4, diff: -4 });
    expect(scored.own?.breakdown?.absolute).toBe(8);
  });
});

describe("election-day Bader-Ofer edges", () => {
  it("passes a list on exactly 3.25% and voids a surplus pair when the partner misses", () => {
    const allocation = allocateBaderOfer({
      lists: [
        { id: "big", votes: 37401 },
        { id: "edge", votes: 1300 },
        { id: "miss", votes: 1299 },
      ],
      agreements: [{ a: "edge", b: "miss" }],
      validVotes: 40000,
    });
    expect(allocation.passed.edge).toBe(true);
    expect(allocation.passed.miss).toBe(false);
    expect(allocation.seats.miss).toBe(0);
    expect(allocation.seats.edge).toBeGreaterThanOrEqual(4);
    expect(allocation.ignoredAgreements).toEqual([expect.objectContaining({ a: "edge", b: "miss", reason: "below-threshold" })]);
    expect(Object.values(allocation.seats).reduce((sum, value) => sum + value, 0)).toBe(120);
  });
});

describe("election-day results ingestion", () => {
  it("keeps the last snapshot when the committee page fails", async () => {
    const db = await memory();
    const group = await createGroup(db, "ועדה", null, OPEN);
    const parties = await listParties(db);
    const parsed = (seats: number): ParsedResults => ({
      status: "provisional",
      countedPercent: 50,
      turnoutPercent: 30,
      eligibleVoters: null,
      ballotsCast: null,
      validVotes: 1000,
      invalidVotes: 0,
      format: "test",
      lists: parties.map((party, index) => ({
        name: party.name,
        ballot: party.ballot,
        votes: index === 0 ? 1000 : 0,
        officialSeats: index === 0 ? seats : 0,
        votePercent: null,
      })),
    });
    const start = new Date("2026-10-27T20:00:00.000Z");
    await ensureFreshSite(db, {
      now: start,
      fetcher: async () => ({ ok: true, parsed: parsed(120), url: "https://example.test/nationalresults" }),
    });
    expect((await getPublicState(db, group.id, null)).results?.parties[0].seats).toBe(120);

    const failed = await ensureFreshSite(db, {
      now: new Date(start.getTime() + 4 * 60 * 1000),
      fetcher: async () => {
        throw new Error("timeout");
      },
    });
    expect(failed.refreshed).toBe(false);
    const kept = await getPublicState(db, group.id, null);
    expect(kept.results?.parties[0].seats).toBe(120);
    expect(kept.fetchProblem).toContain("נכשל");

    const malformed = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "https://example.test/nationalresults",
      fetchImpl: async () => new Response("<html><body>not a results table</body></html>", { status: 200 }),
    });
    expect(malformed.ok).toBe(false);

    const timedOut = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "https://example.test/nationalresults",
      fetchImpl: async () => {
        throw new Error("The operation was aborted due to timeout");
      },
    });
    expect(timedOut.ok).toBe(false);

    const manual: Record<string, number> = {};
    parties.forEach((party, index) => {
      manual[party.id] = index === 1 ? 120 : 0;
    });
    await saveManualResults(db, {
      seatsByPartyId: manual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: 70,
    });
    const blocked = await ensureFreshSite(db, {
      force: true,
      now: new Date(start.getTime() + 8 * 60 * 1000),
      fetcher: async () => ({ ok: true, parsed: parsed(120), url: "https://example.test/nationalresults" }),
    });
    expect(blocked.refreshed).toBe(false);
    expect((await getPublicState(db, group.id, null)).results?.source).toBe("manual");
  });
});

describe("election-day groups", () => {
  it("does not leak another person's seats, and an invalid code finds nothing", async () => {
    const db = await memory();
    const parties = await listParties(db);
    const group = await createGroup(db, "סוד", null, OPEN, "owner");
    const alice = await joinGroup(db, group.id, "נועה");
    const bob = await joinGroup(db, group.id, "עידו");
    await savePrediction(db, group.id, alice.token, full(parties, 83, 37));
    const stranger = await getPublicState(db, group.id, bob.token);
    expect(stranger.revealed).toBeNull();
    expect(stranger.own?.alias).toBe("עידו");
    expect(stranger.own?.prediction.every((row) => row.seats === 0)).toBe(true);
    expect(stranger.standings.every((row) => !("prediction" in row))).toBe(true);
    expect(JSON.stringify(stranger)).not.toContain(group.adminToken);
    expect(await getGroupByCode(db, "NO-SUCH")).toBeNull();
    expect(await getGroupByCode(db, "'; DROP TABLE groups;--")).toBeNull();
    expect(await getGroupByCode(db, group.code)).not.toBeNull();

    const quiet = await createGroup(db, "בלי דירוג", null, OPEN);
    await updateGroup(db, quiet.id, { publicBoard: false });
    const hidden = await joinGroup(db, quiet.id, "נסתרת");
    await savePrediction(db, quiet.id, hidden.token, full(parties, 83, 37));
    await saveManualResults(db, {
      seatsByPartyId: full(parties, 83, 37),
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });
    const board = await globalLeaderboard(db);
    expect(board.rows.map((row) => row.alias)).toContain("נועה");
    expect(board.rows.map((row) => row.alias)).not.toContain("נסתרת");
    expect(JSON.stringify(board)).not.toContain(group.adminToken);
  });
});

describe("election-day stakes", () => {
  it("pays whole agorot, and a full podium sums back to the pot", () => {
    expect(parseStakeIls("0")).toBe(0);
    expect(parseStakeIls("0.01")).toBe(1);
    expect(() => parseStakeIls("10.001")).toThrow(/שקלים/);
    const places = allocateByPercent(101, [60, 30, 10]);
    expect(places.reduce((sum, value) => sum + value, 0)).toBe(101);
    expect(places.every((value) => Number.isInteger(value))).toBe(true);

    const paid = computeWinnings({
      buyInAgorot: 101,
      participantCount: 1,
      split: [60, 30, 10],
      finishers: [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
        { id: "c", rank: 3 },
      ],
    });
    expect(paid.potAgorot).toBe(101);
    const sum = [...paid.byId.values()].reduce((total, value) => total + value, 0);
    expect(sum).toBe(101);

    const tied = computeWinnings({
      buyInAgorot: 50,
      participantCount: 3,
      split: [60, 30, 10],
      finishers: [
        { id: "b", rank: 1 },
        { id: "a", rank: 1 },
        { id: "c", rank: 3 },
      ],
    });
    expect((tied.byId.get("a") ?? 0) + (tied.byId.get("b") ?? 0) + (tied.byId.get("c") ?? 0)).toBe(tied.potAgorot);
    expect(Math.abs((tied.byId.get("a") ?? 0) - (tied.byId.get("b") ?? 0))).toBeLessThanOrEqual(1);
    expect(tied.byId.get("a")).toBeGreaterThan(tied.byId.get("b") ?? 0);

    const empty = computeWinnings({
      buyInAgorot: 0,
      participantCount: 4,
      split: [100],
      finishers: [{ id: "a", rank: 1 }],
    });
    expect(empty.potAgorot).toBe(0);
    expect(empty.byId.get("a")).toBe(0);
  });
});

describe("election-day crowd boundary", () => {
  it("stays hidden at 4 complete bets and shows only aggregates at 5", async () => {
    const db = await memory();
    const parties = await listParties(db);
    const group = await createGroup(db, "קהל", null, OPEN);
    for (let index = 0; index < 4; index += 1) {
      const person = await joinGroup(db, group.id, `שחקן ${index}`);
      await savePrediction(db, group.id, person.token, full(parties, index === 0 ? 73 : 10, index === 0 ? 47 : 110));
    }
    const hidden = await readGroupCrowd(db, group.id);
    expect(hidden).toMatchObject({ visible: false, reason: "min", sampleSize: 4, minBets: 5 });
    expect(JSON.stringify(hidden)).not.toContain("73");

    const fifth = await joinGroup(db, group.id, "חמישי");
    await savePrediction(db, group.id, fifth.token, full(parties, 10, 110));
    const shown = await readGroupCrowd(db, group.id);
    expect(shown.visible).toBe(true);
    expect(shown.sampleSize).toBe(5);
    expect(numbersIn(shown)).not.toContain(73);
    const shownJson = JSON.stringify(shown);
    expect(shownJson).not.toContain("שחקן");
    expect(shownJson).not.toContain("חמישי");
    expect(shownJson).not.toContain("prediction");
    expect(shown.parties.find((party) => party.partyId === parties[0].id)?.mean).toBe(22.6);
  });
});

describe("election-day auth and the national board", () => {
  it("hides providers in production and keeps one bet on the account", async () => {
    const modes = authModes({ NODE_ENV: "production" });
    expect(modes).toEqual({ google: false, email: false, devInbox: false });

    const db = await memory();
    const parties = await listParties(db);
    const group = await createGroup(db, "חשבון", null, OPEN);
    const alice = await createAccount(db, "alice@example.com");
    const bob = await createAccount(db, "bob@example.com");
    await joinGroup(db, group.id, "נועה", Date.now(), alice.id);
    await savePredictionForUser(db, group.id, alice.id, full(parties, 55, 65));
    await expect(joinGroup(db, group.id, "נועה 2", Date.now(), alice.id)).rejects.toThrow(/כבר/);
    await expect(savePredictionForUser(db, group.id, bob.id, full(parties, 10, 110))).rejects.toThrow(/אין לכם/);
    const asBob = await getPublicState(db, group.id, null, bob.id);
    expect(asBob.own).toBeNull();
    expect(JSON.stringify(asBob)).not.toContain("alice@example.com");
    expect(JSON.stringify(await getPublicState(db, group.id, null, alice.id))).not.toContain("alice@example.com");
  });

  it("pages the national board and leaves an empty board explicit", async () => {
    const empty = await globalLeaderboard(await memory());
    expect(empty).toMatchObject({ total: 0, page: 1, pageCount: 1, rows: [] });

    const db = await memory();
    const parties = await listParties(db);
    const group = await createGroup(db, "עמודים", null, OPEN);
    for (let index = 0; index < 3; index += 1) {
      const person = await joinGroup(db, group.id, `מדורג ${index}`);
      await savePrediction(db, group.id, person.token, full(parties, 40 + index, 80 - index));
    }
    await saveManualResults(db, {
      seatsByPartyId: full(parties, 40, 80),
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });
    const first = await globalLeaderboard(db, { page: 1, pageSize: 2 });
    const second = await globalLeaderboard(db, { page: 2, pageSize: 2 });
    const overflow = await globalLeaderboard(db, { page: 9, pageSize: 2 });
    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(1);
    expect(first.pageCount).toBe(2);
    expect(overflow.page).toBe(2);
    expect(first.rows.map((row) => row.alias).some((alias) => second.rows.some((row) => row.alias === alias))).toBe(false);
  });
});
