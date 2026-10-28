import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allocateBaderOfer } from "./bader-ofer";
import { parseCecHtml } from "./parse-cec";

const AGREEMENTS = [
  { a: "מחל", b: "ט" },
  { a: "פה", b: "כן" },
  { a: "שס", b: "ג" },
  { a: "אמת", b: "מרצ" },
];

describe("Bader-Ofer against the 2022 official results", () => {
  const html = readFileSync(path.join(process.cwd(), "fixtures/votes25-national.html"), "utf8");
  const parsed = parseCecHtml(html);
  if (!parsed) throw new Error("fixture did not parse");

  const lists = parsed.lists.map((list) => ({
    id: list.ballot,
    votes: list.votes ?? 0,
    official: list.officialSeats ?? 0,
  }));

  it("reproduces every official seat total when the real surplus agreements are applied", () => {
    const allocation = allocateBaderOfer({
      lists: lists.map(({ id, votes }) => ({ id, votes })),
      agreements: AGREEMENTS,
      validVotes: parsed.validVotes ?? undefined,
    });
    const initial = Object.values(allocation.initialSeats).reduce((sum, value) => sum + value, 0);
    expect(initial).toBe(113);
    expect(allocation.remainderSeats).toBe(7);
    expect(allocation.passed["מרצ"]).toBe(false);
    expect(allocation.ignoredAgreements).toEqual([
      expect.objectContaining({ a: "אמת", b: "מרצ", reason: "below-threshold" }),
    ]);
    for (const list of lists) {
      expect(allocation.seats[list.id], list.id).toBe(list.official);
    }
    expect(Object.values(allocation.seats).reduce((sum, value) => sum + value, 0)).toBe(120);
  });

  it("does not match the official seats when surplus agreements are ignored", () => {
    const allocation = allocateBaderOfer({
      lists: lists.map(({ id, votes }) => ({ id, votes })),
      validVotes: parsed.validVotes ?? undefined,
    });
    expect(allocation.seats["מחל"]).toBe(31);
    expect(allocation.seats["אמת"]).toBe(5);
  });
});
