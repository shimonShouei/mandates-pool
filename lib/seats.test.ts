import { describe, expect, it } from "vitest";
import { KNESSET_SEATS, checkSeatVector, passesElectoralThreshold } from "./seats";

describe("seat checks", () => {
  it("requires whole seats that sum to 120", () => {
    expect(checkSeatVector([60, 60]).ok).toBe(true);
    const badSum = checkSeatVector([60, 50]);
    expect(badSum.ok).toBe(false);
    if (!badSum.ok) expect(badSum.error).toContain(String(KNESSET_SEATS));
    expect(checkSeatVector([60.5, 59.5]).ok).toBe(false);
    expect(checkSeatVector([-1, 121]).ok).toBe(false);
    const tooMany = checkSeatVector([121, 0]);
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.error).toContain("120");
  });

  it("warns that 1 to 3 seats cannot clear the threshold", () => {
    const result = checkSeatVector([117, 3]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings[0]).toContain("3.25%");
    expect(checkSeatVector([116, 4]).ok).toBe(true);
    if (checkSeatVector([116, 4]).ok) expect(checkSeatVector([116, 4])).toMatchObject({ warnings: [] });
  });

  it("applies the 3.25% threshold on an integer boundary", () => {
    expect(passesElectoralThreshold(1300, 40000)).toBe(true);
    expect(passesElectoralThreshold(1299, 40000)).toBe(false);
  });
});
