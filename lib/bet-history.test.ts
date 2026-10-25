import { describe, expect, it } from "vitest";
import { diffSeats, exposureLevel, membersCanSeeBets, revisionsFromVersions } from "./bet-history";

const parties = [
  { id: "a", name: "א", color: "#111111" },
  { id: "b", name: "ב", color: "#222222" },
];

describe("bet history", () => {
  it("diffs each save against the previous seat vector", () => {
    const revisions = revisionsFromVersions(parties, [
      { savedAt: "2026-10-01T00:00:00.000Z", seats: { a: 77, b: 43 } },
      { savedAt: "2026-10-02T00:00:00.000Z", seats: { a: 70, b: 50 } },
      { savedAt: "2026-10-03T00:00:00.000Z", seats: { a: 70, b: 50 } },
    ]);
    expect(revisions[0].changes).toEqual([
      { partyId: "a", name: "א", color: "#111111", before: 0, after: 77 },
      { partyId: "b", name: "ב", color: "#222222", before: 0, after: 43 },
    ]);
    expect(diffSeats(parties, { a: 77, b: 43 }, { a: 70, b: 50 })).toEqual([
      { partyId: "a", name: "א", color: "#111111", before: 77, after: 70 },
      { partyId: "b", name: "ב", color: "#222222", before: 43, after: 50 },
    ]);
    expect(revisions[2].changes).toEqual([]);
  });

  it("treats open-before-lock as the wider exposure", () => {
    expect(exposureLevel("anonymous", true)).toBe(0);
    expect(exposureLevel("open", false)).toBe(1);
    expect(exposureLevel("open", true)).toBe(2);
    expect(membersCanSeeBets({ visibility: "anonymous", revealBeforeLock: false }, true)).toBe(false);
    expect(membersCanSeeBets({ visibility: "open", revealBeforeLock: false }, false)).toBe(false);
    expect(membersCanSeeBets({ visibility: "open", revealBeforeLock: false }, true)).toBe(true);
    expect(membersCanSeeBets({ visibility: "open", revealBeforeLock: true }, false)).toBe(true);
  });
});
