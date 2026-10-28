import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSqliteDb } from "./db";
import { applyParsedResults, saveManualResults, listParties } from "./game";
import { parseCecHtml } from "./results/parse-cec";
import { adoptionDecision, scheduledResultsRefresh } from "./refresh";

const html = readFileSync(path.join(process.cwd(), "fixtures/votes26-national.html"), "utf8");

function parsedPage() {
  const parsed = parseCecHtml(html);
  if (!parsed) throw new Error("fixture did not parse");
  return parsed;
}

describe("adoption", () => {
  it("keeps a stored count that is newer or more complete", () => {
    const stored = {
      status: "provisional" as const,
      countedPercent: 80,
      fetchedAt: "2026-10-28T12:00:00.000Z",
      validVotes: 5_000_000,
    };
    expect(
      adoptionDecision(stored, {
        status: "provisional",
        countedPercent: 60,
        reportedAt: "2026-10-28T10:32:00.000Z",
        validVotes: 4_401_898,
      }),
    ).toEqual({ adopt: false, reason: "less-complete" });
    expect(
      adoptionDecision(stored, {
        status: "provisional",
        countedPercent: 80,
        reportedAt: "2026-10-28T11:00:00.000Z",
        validVotes: 5_000_000,
      }),
    ).toEqual({ adopt: false, reason: "not-newer" });
  });

  it("adopts a newer count, a higher percent, or a final file", () => {
    const stored = {
      status: "provisional" as const,
      countedPercent: 60,
      fetchedAt: "2026-10-28T09:00:00.000Z",
      validVotes: 3_000_000,
    };
    expect(
      adoptionDecision(stored, {
        status: "provisional",
        countedPercent: null,
        reportedAt: "2026-10-28T10:32:00.000Z",
        validVotes: 4_401_898,
      }).reason,
    ).toBe("newer");
    expect(
      adoptionDecision(stored, {
        status: "provisional",
        countedPercent: 77.6,
        reportedAt: "2026-10-28T08:00:00.000Z",
        validVotes: 4_000_000,
      }).reason,
    ).toBe("higher-percent");
    expect(
      adoptionDecision(stored, {
        status: "final",
        countedPercent: 100,
        reportedAt: "2026-10-28T08:00:00.000Z",
        validVotes: 1,
      }),
    ).toEqual({ adopt: true, reason: "fetched-final" });
    expect(
      adoptionDecision(
        { ...stored, status: "final", countedPercent: 100 },
        { status: "final", countedPercent: 100, reportedAt: "2026-10-28T18:00:00.000Z", validVotes: 9 },
      ),
    ).toEqual({ adopt: false, reason: "already-final" });
  });
});

describe("scheduled results refresh", () => {
  it("replaces an earlier manual entry with the official page and then refuses to go backwards", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listParties(db);
    const seats: Record<string, number> = {};
    const votes: Record<string, number | null> = {};
    parties.forEach((party, index) => {
      seats[party.id] = index === 0 ? 120 : 0;
      votes[party.id] = index === 0 ? 1_000_000 : 0;
    });
    await saveManualResults(db, {
      seatsByPartyId: seats,
      votesByPartyId: votes,
      computeFromVotes: false,
      status: "provisional",
      countedPercent: null,
      turnoutPercent: null,
    });
    await db.run(`UPDATE result_snapshots SET fetched_at = ? WHERE is_current = 1`, ["2026-10-28T08:00:00.000Z"]);

    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { ok: true as const, parsed: parsedPage(), url: "https://votes26.bechirot.gov.il/nationalresults" };
    };
    const updated = await scheduledResultsRefresh(db, { fetcher });
    expect(calls).toBe(1);
    expect(updated.updated).toBe(true);
    expect(updated.reason).toBe("newer");
    expect(updated.source).toBe("official");
    expect(updated.isFinal).toBe(false);
    expect(updated.percentCounted).toBeNull();
    expect(updated.fetchedAt).toBe("2026-10-28T10:32:00.000Z");
    expect(updated.error).toBeNull();
    expect(updated.seats.reduce((sum, row) => sum + row.seats, 0)).toBe(120);
    const byBallot = Object.fromEntries(updated.seats.map((row) => [row.ballot, row.seats]));
    expect(byBallot).toMatchObject({
      מחל: 27,
      דרך: 22,
      רק: 12,
      ודם: 11,
      אמת: 8,
      ג: 7,
      ל: 7,
      ב: 7,
      שס: 7,
      עם: 6,
      ט: 6,
    });
    const likud = updated.seats.find((row) => row.ballot === "מחל");

    const backwards = await scheduledResultsRefresh(db, {
      fetcher: async () => ({
        ok: true,
        url: "https://votes26.bechirot.gov.il/nationalresults",
        parsed: {
          ...parsedPage(),
          reportedAt: "2026-10-28T07:00:00.000Z",
          validVotes: 500_000,
          lists: parsedPage().lists.map((list) => ({ ...list, votes: list.ballot === "מחל" ? 500_000 : 0 })),
        },
      }),
    });
    expect(backwards.updated).toBe(false);
    expect(backwards.reason).toBe("less-complete");
    expect(backwards.source).toBe("official");
    expect(backwards.seats.find((row) => row.ballot === "מחל")?.seats).toBe(likud?.seats);
  });

  it("does not call the committee once the stored count is final", async () => {
    const db = await createSqliteDb(":memory:");
    const parsed = parsedPage();
    await applyParsedResults(db, { ...parsed, status: "final", countedPercent: 100 }, {
      source: "official",
      sourceUrl: "https://votes26.bechirot.gov.il/nationalresults",
      fetchedAt: parsed.reportedAt ?? undefined,
    });
    let calls = 0;
    const report = await scheduledResultsRefresh(db, {
      fetcher: async () => {
        calls += 1;
        return { ok: true, parsed, url: "https://votes26.bechirot.gov.il/nationalresults" };
      },
    });
    expect(calls).toBe(0);
    expect(report).toMatchObject({ updated: false, reason: "already-final", isFinal: true, source: "official", percentCounted: 100 });
  });
});
