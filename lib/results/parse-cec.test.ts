import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCecHtml, parseCecPayload } from "./parse-cec";

describe("CEC results parser", () => {
  it("reads the 2022 national results table", () => {
    const html = readFileSync(path.join(process.cwd(), "fixtures/votes25-national.html"), "utf8");
    const parsed = parseCecHtml(html);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.format).toBe("cec-html-table");
    expect(parsed.status).toBe("final");
    expect(parsed.countedPercent).toBe(100);
    expect(parsed.turnoutPercent).toBeCloseTo(70.63);
    expect(parsed.eligibleVoters).toBe(6788804);
    expect(parsed.ballotsCast).toBe(4794593);
    expect(parsed.validVotes).toBe(4764742);
    expect(parsed.invalidVotes).toBe(29851);
    expect(parsed.lists).toHaveLength(40);
    const likud = parsed.lists.find((list) => list.ballot === "מחל");
    expect(likud).toMatchObject({ votes: 1115336, officialSeats: 32 });
    expect(parsed.lists.reduce((sum, list) => sum + (list.votes ?? 0), 0)).toBe(4764742);
    expect(parsed.lists.reduce((sum, list) => sum + (list.officialSeats ?? 0), 0)).toBe(120);
  });

  it("reads a provisional page that has votes but no mandates", () => {
    const html = readFileSync(path.join(process.cwd(), "fixtures/votes25-provisional.html"), "utf8");
    const parsed = parseCecPayload(html);
    expect(parsed).toMatchObject({
      status: "provisional",
      countedPercent: 63.5,
      validVotes: 2980000,
      format: "cec-html-table",
    });
    expect(parsed?.lists).toHaveLength(4);
    expect(parsed?.lists.every((list) => list.officialSeats == null)).toBe(true);
    expect(parsed?.lists[0]).toMatchObject({ ballot: "מחל", votes: 1192000 });
  });

  it("reads a JSON feed when one is exposed", () => {
    const parsed = parseCecPayload(
      JSON.stringify({
        final: false,
        countedPercent: 12.5,
        eligible: 7000000,
        valid: 800000,
        lists: [
          { name: "הליכוד", letters: "מחל", votes: 500000 },
          { name: "ביחד", ballot: "רק", votes: 300000, mandates: null },
        ],
      }),
    );
    expect(parsed).toMatchObject({
      status: "provisional",
      countedPercent: 12.5,
      validVotes: 800000,
      format: "cec-json",
    });
    expect(parsed?.lists[0]).toMatchObject({ ballot: "מחל", votes: 500000, officialSeats: null });
  });

  it("reads the 2026 national page: cards, no mandate column, and the as-of clock", () => {
    const html = readFileSync(path.join(process.cwd(), "fixtures/votes26-national.html"), "utf8");
    const parsed = parseCecHtml(html);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.status).toBe("provisional");
    expect(parsed.countedPercent).toBeNull();
    expect(parsed.turnoutPercent).toBeNull();
    expect(parsed.eligibleVoters).toBe(7331981);
    expect(parsed.ballotsCast).toBe(4421561);
    expect(parsed.validVotes).toBe(4401898);
    expect(parsed.invalidVotes).toBe(19663);
    expect(parsed.reportedAt).toBe("2026-10-28T10:32:00.000Z");
    expect(parsed.lists).toHaveLength(38);
    expect(parsed.lists.find((list) => list.ballot === "מחל")).toMatchObject({
      votes: 917371,
      officialSeats: null,
    });
    expect(parsed.lists.find((list) => list.ballot === "דרך")?.votes).toBe(723703);
    expect(parsed.lists.every((list) => list.officialSeats == null)).toBe(true);
    expect(parsed.lists.reduce((sum, list) => sum + (list.votes ?? 0), 0)).toBe(4401898);
  });
});
