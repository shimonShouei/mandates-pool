import { describe, expect, it } from "vitest";
import { readGroupCrowd, readSiteCrowd } from "./board-cache";
import { aggregateCrowd, cleanCrowdMin, histogram, presentCrowd, quartiles } from "./crowd";
import { createSqliteDb } from "./db";
import {
  createBloc,
  createGroup,
  getPublicState,
  joinGroup,
  listParties,
  saveManualResults,
  savePrediction,
  updateBloc,
  updateGroup,
  updateSite,
} from "./game";
import { globalLeaderboard } from "./leaderboard";
import { pollsOpenIso } from "./time";

const OPEN_UNTIL = pollsOpenIso("2099-01-01");

function seats(parties: { id: string }[], first: number, second: number) {
  const values: Record<string, number> = {};
  parties.forEach((party, index) => {
    values[party.id] = 0;
    if (index === 0) values[party.id] = first;
    if (index === 1) values[party.id] = second;
  });
  return values;
}

describe("crowd aggregation", () => {
  it("computes quartiles, a histogram, pass rate, and a 61-seat bloc", () => {
    expect(quartiles([0, 10, 20, 30, 40])).toEqual({ q1: 5, median: 20, q3: 35 });
    expect(quartiles([0, 10, 20, 30])).toEqual({ q1: 5, median: 15, q3: 25 });
    const report = aggregateCrowd({
      partyIds: ["a", "b"],
      vectors: [
        [0, 120],
        [3, 117],
        [4, 116],
        [10, 110],
        [30, 70],
        [40, 61],
      ],
      actual: { a: 32, b: 88 },
      blocs: [{ id: "right", name: "ימין", partyIds: ["a"] }],
      minBets: 5,
    });
    expect(report.visible).toBe(true);
    expect(report.sampleSize).toBe(6);
    const party = report.parties[0];
    expect(party.mean).toBe(14.5);
    expect(party.median).toBe(7);
    expect(party.q1).toBeLessThanOrEqual(party.median);
    expect(party.median).toBeLessThanOrEqual(party.q3);
    expect(party.passPercent).toBe(67);
    expect(party.actual).toBe(32);
    expect(party.histogram.reduce((sum, bin) => sum + bin.count, 0)).toBe(6);
    expect(report.blocs[0]).toMatchObject({
      name: "ימין",
      majorityPercent: 0,
      actual: 32,
      actualMajority: false,
    });
    const both = aggregateCrowd({
      partyIds: ["a", "b"],
      vectors: [
        [30, 30],
        [40, 30],
      ],
      actual: null,
      blocs: [{ id: "all", name: "כולם", partyIds: ["a", "b"] }],
      minBets: 2,
    });
    expect(both.blocs[0].majorityPercent).toBe(50);
    expect(both.blocs[0].actual).toBeNull();
    expect(histogram([0, 0, 12]).reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  });

  it("hides every aggregate below the minimum, including a single distinctive guess", () => {
    expect(() => cleanCrowdMin(1)).toThrow(/2/);
    expect(cleanCrowdMin(5)).toBe(5);
    const report = aggregateCrowd({
      partyIds: ["a"],
      vectors: [[77]],
      actual: null,
      blocs: [],
      minBets: 5,
    });
    expect(report).toMatchObject({ visible: false, reason: "min", sampleSize: 1, minBets: 5 });
    expect(report.parties).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("77");
    const locked = aggregateCrowd({
      partyIds: ["a"],
      vectors: [[77], [10], [10], [10], [10]],
      actual: { a: 12 },
      blocs: [],
      minBets: 5,
      hiddenBecauseUnlocked: true,
    });
    expect(locked.reason).toBe("lock");
    expect(locked.sampleSize).toBeNull();
    expect(JSON.stringify(locked)).not.toContain("77");
    expect(JSON.stringify(presentCrowd(locked, [{ id: "a", name: "א", ballot: "", color: "#000" }])).includes("77")).toBe(
      false,
    );
  });
});

describe("stored crowd", () => {
  it("keeps a small sample and opted-out groups out of the public aggregate", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listParties(db);
    const group = await createGroup(db, "קטנה", null, OPEN_UNTIL);
    let distinctive: Awaited<ReturnType<typeof joinGroup>> | null = null;
    for (let index = 0; index < 4; index += 1) {
      const person = await joinGroup(db, group.id, `שחקן ${index}`);
      if (index === 0) distinctive = person;
      await savePrediction(db, group.id, person.token, seats(parties, index === 0 ? 77 : 10, index === 0 ? 43 : 110));
    }
    const early = await readGroupCrowd(db, group.id);
    expect(early).toMatchObject({ visible: false, reason: "min", sampleSize: 4 });
    expect(JSON.stringify(early)).not.toContain("77");
    const state = await getPublicState(db, group.id, null);
    expect(JSON.stringify(state)).not.toContain("77");
    await savePrediction(db, group.id, distinctive!.token, seats(parties, 10, 110));

    const fifth = await joinGroup(db, group.id, "חמישי");
    await savePrediction(db, group.id, fifth.token, seats(parties, 10, 110));
    const bloc = await createBloc(db, "גוש הבדיקה");
    await updateBloc(db, bloc.id, { name: "גוש הבדיקה", partyIds: [parties[0].id, parties[1].id] });
    const ready = await readGroupCrowd(db, group.id);
    expect(ready.visible).toBe(true);
    expect(ready.sampleSize).toBe(5);
    expect(ready.blocs[0].name).toBe("גוש הבדיקה");
    expect(ready.blocs[0].majorityPercent).toBe(100);

    const hidden = await createGroup(db, "פרטית", null, OPEN_UNTIL);
    await updateGroup(db, hidden.id, { publicBoard: false });
    for (let index = 0; index < 5; index += 1) {
      const person = await joinGroup(db, hidden.id, `נסתר ${index}`);
      await savePrediction(db, hidden.id, person.token, seats(parties, 77, 43));
    }
    const site = await readSiteCrowd(db);
    const first = site.parties.find((party) => party.partyId === parties[0].id);
    const second = site.parties.find((party) => party.partyId === parties[1].id);
    expect(first?.mean).toBe(10);
    expect(second?.mean).toBe(110);
    const publicNumbers = JSON.stringify({
      parties: site.parties.map((row) => ({
        mean: row.mean,
        median: row.median,
        q1: row.q1,
        q3: row.q3,
        passPercent: row.passPercent,
        histogram: row.histogram,
        actual: row.actual,
      })),
      blocs: site.blocs.map((row) => ({
        name: row.name,
        mean: row.mean,
        median: row.median,
        q1: row.q1,
        q3: row.q3,
        majorityPercent: row.majorityPercent,
        actual: row.actual,
        actualMajority: row.actualMajority,
      })),
    });
    expect(publicNumbers).not.toContain("77");
    const national = await globalLeaderboard(db, { pageSize: 20 });
    expect(JSON.stringify(national)).not.toMatch(/histogram|passPercent|majorityPercent/);

    await updateSite(db, { crowdBeforeLock: false });
    const closed = await readGroupCrowd(db, group.id);
    expect(closed.reason).toBe("lock");
    expect(JSON.stringify(closed)).not.toContain("77");
    await updateGroup(db, group.id, { electionStart: pollsOpenIso("2020-01-01") });
    const afterLock = await readGroupCrowd(db, group.id);
    expect(afterLock.visible).toBe(true);

    const actual: Record<string, number> = {};
    parties.forEach((party, index) => {
      actual[party.id] = index === 0 ? 32 : index === 1 ? 88 : 0;
    });
    await saveManualResults(db, {
      seatsByPartyId: actual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });
    const compared = await readGroupCrowd(db, group.id);
    expect(compared.parties.find((party) => party.partyId === parties[0].id)?.actual).toBe(32);
    expect(compared.blocs[0].actual).toBe(120);
    expect(compared.blocs[0].actualMajority).toBe(true);
  });
});
