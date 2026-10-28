import { describe, expect, it } from "vitest";
import { createSqliteDb } from "./db";
import {
  createGroup,
  getPublicState,
  isGroupAdmin,
  joinGroup,
  listParties,
  saveManualResults,
  savePrediction,
  updateGroup,
  updateGroupAsAdmin,
} from "./game";
import { globalLeaderboard } from "./leaderboard";
import { createPublicGroup } from "./rate-limit";
import { pollsOpenIso } from "./time";

const OPEN_UNTIL = pollsOpenIso("2099-01-01");

async function memory() {
  return createSqliteDb(":memory:");
}

function fill(parties: { id: string }[], first: number, second: number, third: number) {
  const seats: Record<string, number> = {};
  parties.forEach((party, index) => {
    seats[party.id] = 0;
    if (index === 0) seats[party.id] = first;
    if (index === 1) seats[party.id] = second;
    if (index === 2) seats[party.id] = third;
  });
  return seats;
}

describe("national board", () => {
  it("ranks across groups, hides opted-out groups, and omits seat vectors", async () => {
    const db = await memory();
    const parties = await listParties(db);
    const alpha = await createGroup(db, "אלפא", null, OPEN_UNTIL);
    const beta = await createGroup(db, "ביתא", null, OPEN_UNTIL);
    const noa = await joinGroup(db, alpha.id, "נועה");
    const ido = await joinGroup(db, beta.id, "עידו");
    const tamar = await joinGroup(db, beta.id, "תמר");
    await savePrediction(db, alpha.id, noa.token, fill(parties, 50, 40, 30));
    await savePrediction(db, beta.id, ido.token, fill(parties, 48, 42, 30));
    await savePrediction(db, beta.id, tamar.token, fill(parties, 17, 60, 43));

    const actual: Record<string, number> = {};
    for (const party of parties) actual[party.id] = 0;
    actual[parties[0].id] = 50;
    actual[parties[1].id] = 40;
    actual[parties[2].id] = 30;
    await saveManualResults(db, {
      seatsByPartyId: actual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });

    const alphaState = await getPublicState(db, alpha.id, null);
    const betaState = await getPublicState(db, beta.id, null);
    expect(alphaState.results?.parties.find((party) => party.ballot === parties[0].ballot)?.seats).toBe(50);
    expect(betaState.results?.parties.find((party) => party.ballot === parties[0].ballot)?.seats).toBe(50);

    const board = await globalLeaderboard(db, { page: 1, pageSize: 2 });
    expect(board.total).toBe(3);
    expect(board.pageCount).toBe(2);
    expect(board.rows).toHaveLength(2);
    expect(board.rows[0]).toMatchObject({ alias: "נועה", groupName: "אלפא", rank: 1, groupRank: 1, euclidean: 0 });
    expect(board.rows[1]).toMatchObject({ alias: "עידו", groupName: "ביתא", rank: 2, groupRank: 1 });
    expect(board.rows[1].groupRank).toBe(1);
    expect(board.rows[1].rank).not.toBe(board.rows[1].groupRank);

    const page2 = await globalLeaderboard(db, { page: 2, pageSize: 2 });
    expect(page2.rows.map((row) => row.alias)).toEqual(["תמר"]);
    expect(page2.rows[0].groupRank).toBe(2);
    expect(page2.rows[0].rank).toBe(3);

    const all = await globalLeaderboard(db, { pageSize: 10 });
    expect(all.rows.map((row) => row.alias)).toEqual(["נועה", "עידו", "תמר"]);
    expect(all.rows[1].absolute).toBe(4);
    expect(all.rows[1].misplaced).toBe(2);
    expect(all.rows[1].rank).toBe(2);
    expect(all.rows[1].groupRank).toBe(1);

    const payload = JSON.stringify(all.rows);
    expect(payload).not.toMatch(/"seats"|"diffs"|"prediction"|"partyId"|"passedCall"/);
    expect(payload).not.toContain("17");
    for (const row of all.rows) {
      expect(Object.keys(row).sort()).toEqual(
        ["absolute", "alias", "euclidean", "groupCode", "groupName", "groupRank", "misplaced", "rank", "score", "thresholdCorrect"].sort(),
      );
    }

    const cached = await db.get<{ payload: string }>(`SELECT payload FROM board_cache WHERE id = 'global'`);
    expect(cached?.payload).toContain("נועה");
    const reread = await globalLeaderboard(db, { pageSize: 10 });
    expect(reread.rows.map((row) => row.alias)).toEqual(all.rows.map((row) => row.alias));

    await updateGroup(db, beta.id, { publicBoard: false });
    const hidden = await globalLeaderboard(db, { pageSize: 10 });
    expect(hidden.rows.map((row) => row.alias)).toEqual(["נועה"]);
    const inside = await getPublicState(db, beta.id, null);
    expect(inside.standings.map((row) => row.alias)).toEqual(["עידו", "תמר"]);
  });

  it("rejects a stranger admin token and accepts the creator token", async () => {
    const db = await memory();
    const group = await createGroup(db, "מנהלים", null, OPEN_UNTIL);
    expect(await isGroupAdmin(db, group.id, "nope")).toBe(false);
    await expect(updateGroupAsAdmin(db, group.id, "nope", { name: "אחר" })).rejects.toThrow(/ניהול/);
    await updateGroupAsAdmin(db, group.id, group.adminToken, { publicBoard: false, name: "מנהלים 2" });
    const state = await getPublicState(db, group.id, null);
    expect(state.group.name).toBe("מנהלים 2");
  });

  it("limits public creation and group names", async () => {
    const db = await memory();
    const now = Date.parse("2026-10-01T12:00:00.000Z");
    for (let index = 0; index < 5; index += 1) {
      await createPublicGroup(db, `קבוצה ${index + 1}`, "203.0.113.8", now);
    }
    await expect(createPublicGroup(db, "קבוצה 6", "203.0.113.8", now)).rejects.toThrow(/יותר מדי/);
    await expect(createPublicGroup(db, "אחרת", "203.0.113.9", now)).resolves.toMatchObject({ name: "אחרת" });
    await expect(createPublicGroup(db, "א", "203.0.113.10", now)).rejects.toThrow(/40/);
    await expect(createPublicGroup(db, "א".repeat(41), "203.0.113.10", now)).rejects.toThrow(/40/);
    await expect(createPublicGroup(db, "קו\nצה", "203.0.113.10", now)).rejects.toThrow(/40/);
  });

  it("pages a few dozen groups without rebuilding on the next read", async () => {
    const db = await memory();
    const parties = await listParties(db);
    const actual: Record<string, number> = {};
    parties.forEach((party, index) => {
      actual[party.id] = index === 0 ? 120 : 0;
    });
    await saveManualResults(db, {
      seatsByPartyId: actual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });

    for (let groupIndex = 0; groupIndex < 30; groupIndex += 1) {
      const group = await createGroup(db, `קבוצה ${groupIndex + 10}`, null, OPEN_UNTIL);
      for (let person = 0; person < 4; person += 1) {
        const joined = await joinGroup(db, group.id, `שחקן ${groupIndex}-${person}`);
        const seats = fill(parties, 120 - person, person, 0);
        await savePrediction(db, group.id, joined.token, seats);
      }
    }

    const started = Date.now();
    const first = await globalLeaderboard(db, { page: 1, pageSize: 40 });
    const again = await globalLeaderboard(db, { page: 2, pageSize: 40 });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(first.total).toBe(120);
    expect(first.rows).toHaveLength(40);
    expect(again.rows).toHaveLength(40);
    expect(again.rows[0].alias).not.toBe(first.rows[0].alias);
    expect(JSON.stringify(first.rows)).not.toMatch(/"seats"/);
    const cachedAt = Date.now();
    const third = await globalLeaderboard(db, { page: 1, pageSize: 40 });
    expect(Date.now() - cachedAt).toBeLessThan(400);
    expect(third.rows[0]).toEqual(first.rows[0]);
  });
});
