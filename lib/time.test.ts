import { describe, expect, it } from "vitest";
import { isLocked, jerusalemLocalToIso } from "./time";

describe("Jerusalem deadlines", () => {
  it("converts summer and winter local times to UTC", () => {
    expect(jerusalemLocalToIso("2026-08-01T20:00")).toBe("2026-08-01T17:00:00.000Z");
    expect(jerusalemLocalToIso("2026-12-01T20:00")).toBe("2026-12-01T18:00:00.000Z");
  });

  it("locks at the deadline instant", () => {
    const deadline = "2026-10-26T17:00:00.000Z";
    expect(isLocked(deadline, Date.parse("2026-10-26T16:59:00.000Z"))).toBe(false);
    expect(isLocked(deadline, Date.parse(deadline))).toBe(true);
    expect(isLocked(null, Date.now())).toBe(false);
  });
});
