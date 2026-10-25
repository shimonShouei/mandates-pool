import { describe, expect, it } from "vitest";
import { buildStandings, cleanThresholdBonus, euclideanDistance, scoreGuess, sumAbsoluteError, toPublicStandings } from "./scoring";

describe("scoring", () => {
  it("computes euclidean distance and the sum of absolute errors", () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
    expect(euclideanDistance([10, 20], [10, 20])).toBe(0);
    expect(sumAbsoluteError([10, 0, 5], [7, 4, 5])).toBe(7);
  });

  it("ranks by absolute error and uses euclidean distance only to split a tie", () => {
    const actual = { a: 30, b: 30, c: 30, d: 30 };
    const rows = buildStandings(
      ["a", "b", "c", "d"],
      actual,
      [
        { id: "peak", alias: "מרוכז", predicted: { a: 40, b: 20, c: 30, d: 30 } },
        { id: "spread", alias: "מפוזר", predicted: { a: 35, b: 25, c: 35, d: 25 } },
      ],
      0,
    );
    expect(rows.every((row) => row.absolute === 20 && row.misplaced === 10)).toBe(true);
    expect(rows.map((row) => row.alias)).toEqual(["מפוזר", "מרוכז"]);
    expect(rows[0].euclidean).toBeLessThan(rows[1].euclidean);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
  });

  it("keeps a worse absolute error behind even when its euclidean distance is smaller", () => {
    const rows = buildStandings(
      ["a", "b", "c", "d"],
      { a: 30, b: 30, c: 30, d: 30 },
      [
        { id: "wide", alias: "רחב", predicted: { a: 36, b: 24, c: 36, d: 24 } },
        { id: "tight", alias: "צר", predicted: { a: 40, b: 20, c: 30, d: 30 } },
      ],
      0,
    );
    expect(rows[0]).toMatchObject({ alias: "צר", absolute: 20, rank: 1 });
    expect(rows[1]).toMatchObject({ alias: "רחב", absolute: 24, rank: 2 });
    expect(rows[1].euclidean).toBeLessThan(rows[0].euclidean);
  });

  it("shares a rank only when the rounded score and the rounded distance both match", () => {
    const rows = buildStandings(
      ["a", "b"],
      { a: 60, b: 60 },
      [
        { id: "far", alias: "רחוק", predicted: { a: 40, b: 80 } },
        { id: "tie-b", alias: "ב", predicted: { a: 61, b: 59 } },
        { id: "tie-a", alias: "א", predicted: { a: 59, b: 61 } },
        { id: "best", alias: "קרוב", predicted: { a: 60, b: 60 } },
      ],
      0,
    );
    expect(rows.map((row) => row.alias)).toEqual(["קרוב", "א", "ב", "רחוק"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 2, 4]);
    expect(rows[0].diffs[0]).toMatchObject({ partyId: "a", predicted: 60, actual: 60, diff: 0, passedCall: true });
  });

  it("subtracts a bonus for each correct threshold call and can turn that bonus off", () => {
    const people = [
      { id: "calls", alias: "קריאות", predicted: { a: 7, b: 3 } },
      { id: "seats", alias: "מושבים", predicted: { a: 10, b: 4 } },
    ];
    const off = buildStandings(["a", "b"], { a: 10, b: 0 }, people, 0);
    expect(off.map((row) => row.alias)).toEqual(["מושבים", "קריאות"]);
    expect(off[0].score).toBe(4);
    expect(off[1].score).toBe(6);
    const on = buildStandings(["a", "b"], { a: 10, b: 0 }, people, 3);
    expect(on.map((row) => row.alias)).toEqual(["קריאות", "מושבים"]);
    expect(on[0]).toMatchObject({ score: 0, thresholdCorrect: 2, absolute: 6 });
    expect(on[1]).toMatchObject({ score: 1, thresholdCorrect: 1, absolute: 4 });
    expect(scoreGuess(["a"], { a: 4 }, { a: 0 }, 0).score).toBe(4);
    expect(cleanThresholdBonus(0)).toBe(0);
    expect(cleanThresholdBonus(0.256)).toBe(0.26);
    expect(() => cleanThresholdBonus(-0.1)).toThrow(/0/);
    expect(() => cleanThresholdBonus(10.01)).toThrow(/10/);
  });

  it("does not put seat vectors on the public leaderboard", () => {
    const internal = buildStandings(["a"], { a: 120 }, [{ id: "p", alias: "כינוי", predicted: { a: 17 } }]);
    const published = toPublicStandings(internal, "someone-else");
    const encoded = JSON.stringify(published);
    expect(encoded).not.toContain("17");
    expect(encoded).not.toContain("diffs");
    expect(encoded).not.toContain("predicted");
    expect(Object.keys(published[0]).sort()).toEqual(
      ["absolute", "alias", "euclidean", "isYou", "misplaced", "rank", "score", "thresholdCorrect"].sort(),
    );
    expect(published[0].isYou).toBe(false);
    expect(published[0].absolute).toBe(103);
    expect(published[0].misplaced).toBe(51.5);
  });
});
