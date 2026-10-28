import { describe, expect, it } from "vitest";
import { createSqliteDb } from "./db";
import {
  createGroup,
  getPublicState,
  joinGroup,
  listParticipantsAdmin,
  listParties,
  saveManualResults,
  savePrediction,
  setPaidAliases,
  updateGroup,
} from "./game";
import { globalLeaderboard } from "./leaderboard";
import { allocateByPercent, computeWinnings, parsePayoutSplit, parseStakeIls } from "./payout";
import { pollsOpenIso } from "./time";

const OPEN_UNTIL = pollsOpenIso("2099-01-01");

describe("payout math", () => {
  it("parses a shekel buy-in and a split that sums to 100", () => {
    expect(parseStakeIls("")).toBe(0);
    expect(parseStakeIls("50")).toBe(5000);
    expect(parseStakeIls("12.5")).toBe(1250);
    expect(parseStakeIls("0")).toBe(0);
    expect(() => parseStakeIls("-1")).toThrow(/שקלים/);
    expect(() => parseStakeIls("1.234")).toThrow(/שקלים/);
    expect(parsePayoutSplit("100")).toEqual([100]);
    expect(parsePayoutSplit("60/30/10")).toEqual([60, 30, 10]);
    expect(parsePayoutSplit("60, 30, 10")).toEqual([60, 30, 10]);
    expect(() => parsePayoutSplit("60/30/20")).toThrow(/100/);
    expect(() => parsePayoutSplit("60.5/39.5")).toThrow(/שלם/);
  });

  it("gives the whole pot to the winner", () => {
    const result = computeWinnings({
      buyInAgorot: 5000,
      participantCount: 4,
      split: [100],
      finishers: [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
        { id: "c", rank: 3 },
      ],
    });
    expect(result.potAgorot).toBe(20000);
    expect(result.byId.get("a")).toBe(20000);
    expect(result.byId.get("b")).toBe(0);
    expect(result.byId.get("c")).toBe(0);
  });

  it("pays 60/30/10 when the top three are distinct", () => {
    const result = computeWinnings({
      buyInAgorot: 1000,
      participantCount: 10,
      split: [60, 30, 10],
      finishers: [
        { id: "third", rank: 3 },
        { id: "first", rank: 1 },
        { id: "second", rank: 2 },
        { id: "rest", rank: 4 },
      ],
    });
    expect(result.potAgorot).toBe(10000);
    expect(result.byId.get("first")).toBe(6000);
    expect(result.byId.get("second")).toBe(3000);
    expect(result.byId.get("third")).toBe(1000);
    expect(result.byId.get("rest")).toBe(0);
  });

  it("splits a tie for first across the places those people occupy", () => {
    const result = computeWinnings({
      buyInAgorot: 5000,
      participantCount: 2,
      split: [60, 30, 10],
      finishers: [
        { id: "b", rank: 1 },
        { id: "a", rank: 1 },
      ],
    });
    expect(result.potAgorot).toBe(10000);
    expect(result.byId.get("a")).toBe(4500);
    expect(result.byId.get("b")).toBe(4500);
    expect([...result.byId.values()].reduce((sum, value) => sum + value, 0)).toBe(9000);
  });

  it("splits a tie for second across second and third", () => {
    const result = computeWinnings({
      buyInAgorot: 1000,
      participantCount: 10,
      split: [60, 30, 10],
      finishers: [
        { id: "winner", rank: 1 },
        { id: "m", rank: 2 },
        { id: "n", rank: 2 },
      ],
    });
    expect(result.byId.get("winner")).toBe(6000);
    expect(result.byId.get("m")).toBe(2000);
    expect(result.byId.get("n")).toBe(2000);
  });

  it("splits an odd pot evenly and gives the extra agora to the earlier id", () => {
    const all = computeWinnings({
      buyInAgorot: 101,
      participantCount: 1,
      split: [100],
      finishers: [
        { id: "c", rank: 1 },
        { id: "a", rank: 1 },
        { id: "b", rank: 1 },
      ],
    });
    expect(all.potAgorot).toBe(101);
    expect(all.byId.get("a")).toBe(34);
    expect(all.byId.get("b")).toBe(34);
    expect(all.byId.get("c")).toBe(33);
    expect([...all.byId.values()].reduce((sum, value) => sum + value, 0)).toBe(101);

    expect(allocateByPercent(101, [60, 30, 10])).toEqual([61, 30, 10]);
    const places = computeWinnings({
      buyInAgorot: 101,
      participantCount: 1,
      split: [60, 30, 10],
      finishers: [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
        { id: "c", rank: 3 },
      ],
    });
    expect([places.byId.get("a"), places.byId.get("b"), places.byId.get("c")]).toEqual([61, 30, 10]);
  });

  it("pays nothing when the buy-in is zero", () => {
    const result = computeWinnings({
      buyInAgorot: 0,
      participantCount: 3,
      split: [60, 30, 10],
      finishers: [{ id: "a", rank: 1 }],
    });
    expect(result.potAgorot).toBe(0);
    expect(result.byId.get("a")).toBe(0);
  });
});

describe("group stake", () => {
  it("shows computed winnings on the group board and hides payment marks", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listParties(db);
    const group = await createGroup(db, "קופה", null, OPEN_UNTIL);
    await updateGroup(db, group.id, { stakeAgorot: 5000, payoutSplit: [60, 30, 10] });
    const noa = await joinGroup(db, group.id, "נועה");
    const ido = await joinGroup(db, group.id, "עידו");
    const tamar = await joinGroup(db, group.id, "תמר");
    const fill = (first: number, second: number, third: number) => {
      const seats: Record<string, number> = {};
      parties.forEach((party, index) => {
        seats[party.id] = 0;
        if (index === 0) seats[party.id] = first;
        if (index === 1) seats[party.id] = second;
        if (index === 2) seats[party.id] = third;
      });
      return seats;
    };
    await savePrediction(db, group.id, noa.token, fill(50, 40, 30));
    await savePrediction(db, group.id, ido.token, fill(48, 42, 30));
    await savePrediction(db, group.id, tamar.token, fill(17, 60, 43));
    const actual: Record<string, number> = {};
    parties.forEach((party, index) => {
      actual[party.id] = index === 0 ? 50 : index === 1 ? 40 : index === 2 ? 30 : 0;
    });
    await saveManualResults(db, {
      seatsByPartyId: actual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });

    const state = await getPublicState(db, group.id, null);
    expect(state.stake).toEqual({ buyInAgorot: 5000, potAgorot: 15000, split: [60, 30, 10] });
    const ordered = [...state.standings].sort((a, b) => a.rank - b.rank);
    expect(ordered.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(ordered.map((row) => row.winningsAgorot)).toEqual([9000, 4500, 1500]);
    expect(JSON.stringify(state)).not.toMatch(/"paid"/);
    expect(JSON.stringify(state.standings)).not.toMatch(/"seats"|"diffs"|"prediction"/);

    const national = await globalLeaderboard(db, { pageSize: 10 });
    expect(JSON.stringify(national)).not.toMatch(/winnings|paid|stake|agorot/);

    await expect(setPaidAliases(db, group.id, "nope", ["נועה"])).rejects.toThrow(/ניהול/);
    await setPaidAliases(db, group.id, group.adminToken, ["נועה"]);
    const admin = await listParticipantsAdmin(db, group.id);
    expect(admin.find((person) => person.alias === "נועה")?.paid).toBe(true);
    expect(admin.filter((person) => person.paid)).toHaveLength(1);
    const after = await getPublicState(db, group.id, null);
    expect(JSON.stringify(after)).not.toMatch(/"paid"/);
    expect(after.standings.map((row) => row.winningsAgorot).sort((a, b) => b - a)).toEqual([9000, 4500, 1500]);
  });
});
