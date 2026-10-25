import { describe, expect, it } from "vitest";
import {
  buildStandings,
  euclideanDistance,
  sumAbsoluteError,
  toPublicStandings,
} from "./scoring";

describe("scoring", () => {
  it("computes euclidean distance", () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
    expect(euclideanDistance([10, 20], [10, 20])).toBe(0);
  });

  it("computes the sum of absolute errors", () => {
    expect(sumAbsoluteError([10, 0, 5], [7, 4, 5])).toBe(7);
  });

  it("ranks by euclidean distance and breaks display ties with absolute error", () => {
    const rows = buildStandings(
      ["a", "b"],
      { a: 60, b: 60 },
      [
        { id: "far", alias: "רחוק", predicted: { a: 40, b: 80 } },
        { id: "tie-b", alias: "ב", predicted: { a: 61, b: 59 } },
        { id: "tie-a", alias: "א", predicted: { a: 59, b: 61 } },
        { id: "best", alias: "קרוב", predicted: { a: 60, b: 60 } },
      ],
    );
    expect(rows.map((row) => row.alias)).toEqual(["קרוב", "א", "ב", "רחוק"]);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
    expect(rows[2].rank).toBe(2);
    expect(rows[3].rank).toBe(4);
    expect(rows[1].absoluteRank).toBe(2);
    expect(rows[0].diffs).toEqual([
      { partyId: "a", predicted: 60, actual: 60, diff: 0 },
      { partyId: "b", predicted: 60, actual: 60, diff: 0 },
    ]);
  });

  it("does not put seat vectors on the public leaderboard", () => {
    const internal = buildStandings(
      ["a"],
      { a: 120 },
      [{ id: "p", alias: "כינוי", predicted: { a: 17 } }],
    );
    const published = toPublicStandings(internal, "someone-else");
    const encoded = JSON.stringify(published);
    expect(encoded).not.toContain("17");
    expect(encoded).not.toContain("diffs");
    expect(encoded).not.toContain("predicted");
    expect(Object.keys(published[0]).sort()).toEqual(
      ["absolute", "absoluteRank", "alias", "euclidean", "isYou", "rank"].sort(),
    );
    expect(published[0].isYou).toBe(false);
  });
});
