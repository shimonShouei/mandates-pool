import { describe, expect, it } from "vitest";
import { betsLocked, isLocked, jerusalemLocalToIso, lockSchedule, pollsOpenIso } from "./time";

describe("Jerusalem deadlines", () => {
  it("converts summer and winter local times to UTC", () => {
    expect(jerusalemLocalToIso("2026-08-01T20:00")).toBe("2026-08-01T17:00:00.000Z");
    expect(jerusalemLocalToIso("2026-12-01T20:00")).toBe("2026-12-01T18:00:00.000Z");
  });

  it("places 07:00 on either side of the 2026 daylight-saving changes", () => {
    expect(pollsOpenIso("2026-10-24")).toBe("2026-10-24T04:00:00.000Z");
    expect(pollsOpenIso("2026-10-27")).toBe("2026-10-27T05:00:00.000Z");
    expect(pollsOpenIso("2026-03-26")).toBe("2026-03-26T05:00:00.000Z");
    expect(pollsOpenIso("2026-03-28")).toBe("2026-03-28T04:00:00.000Z");
    expect(pollsOpenIso("2026-08-01")).toBe("2026-08-01T04:00:00.000Z");
    expect(pollsOpenIso("2026-12-01")).toBe("2026-12-01T05:00:00.000Z");
  });

  it("locks at the deadline instant", () => {
    const deadline = "2026-10-26T17:00:00.000Z";
    expect(isLocked(deadline, Date.parse("2026-10-26T16:59:00.000Z"))).toBe(false);
    expect(isLocked(deadline, Date.parse(deadline))).toBe(true);
    expect(isLocked(null, Date.now())).toBe(false);
  });

  it("locks at polls opening and lets an earlier manual lock win", () => {
    const open = pollsOpenIso("2026-10-27");
    const at = Date.parse(open);
    expect(betsLocked(open, null, at - 1)).toBe(false);
    expect(betsLocked(open, null, at)).toBe(true);

    const early = new Date(at - 60 * 60 * 1000).toISOString();
    expect(lockSchedule(open, early)).toEqual({ lockAt: early, reason: "manual" });
    expect(betsLocked(open, early, Date.parse(early) - 1)).toBe(false);
    expect(betsLocked(open, early, Date.parse(early))).toBe(true);

    const later = new Date(at + 24 * 60 * 60 * 1000).toISOString();
    expect(lockSchedule(open, later)).toEqual({ lockAt: open, reason: "election" });
    expect(betsLocked(open, later, at - 1)).toBe(false);
    expect(betsLocked(open, later, at)).toBe(true);
    expect(lockSchedule(open, null)).toEqual({ lockAt: open, reason: "election" });
  });
});
