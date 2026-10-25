import { describe, expect, it } from "vitest";
import { createSqliteDb } from "./db";
import {
  createGroup,
  getPublicState,
  joinGroup,
  listParticipantsAdmin,
  listParties,
  saveManualResults,
  savePrediction,
} from "./game";
import { ensureFreshResults } from "./refresh";
import type { ParsedResults } from "./results/parse-cec";

async function memory() {
  return createSqliteDb(":memory:");
}

describe("pool privacy and winner", () => {
  it("ranks the closest guess and never returns anyone else's seats", async () => {
    const db = await memory();
    const group = await createGroup(db, "חברים של שמעון");
    const parties = await listParties(db, group.id);
    const [a, b, c] = parties;
    const others = parties.slice(3);

    const alice = await joinGroup(db, group.id, "נועה");
    const bob = await joinGroup(db, group.id, "עידו");
    const carol = await joinGroup(db, group.id, "תמר");

    const fill = (first: number, second: number, third: number) => {
      const seats: Record<string, number> = {};
      for (const party of parties) seats[party.id] = 0;
      seats[a.id] = first;
      seats[b.id] = second;
      seats[c.id] = third;
      return seats;
    };

    await savePrediction(db, group.id, alice.token, fill(50, 40, 30));
    await savePrediction(db, group.id, bob.token, fill(48, 42, 30));
    await savePrediction(db, group.id, carol.token, fill(17, 60, 43));

    const actual: Record<string, number> = {};
    for (const party of parties) actual[party.id] = 0;
    actual[a.id] = 50;
    actual[b.id] = 40;
    actual[c.id] = 30;
    for (const party of others) actual[party.id] = 0;
    await saveManualResults(db, group.id, {
      seatsByPartyId: actual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });

    const anon = await getPublicState(db, group.id, null);
    expect(anon.own).toBeNull();
    expect(anon.standings.map((row) => row.alias)).toEqual(["נועה", "עידו", "תמר"]);
    expect(anon.standings[0]).toMatchObject({ rank: 1, euclidean: 0, absolute: 0, isYou: false });
    expect(anon.standings[1].rank).toBe(2);
    expect(anon.standings[1].absolute).toBe(4);
    expect(anon.standings.every((row) => !("diffs" in row) && !("prediction" in row))).toBe(true);
    expect(anon.results?.parties.map((party) => party.seats)).not.toContain(17);
    expect(anon.results?.parties.map((party) => party.seats)).not.toContain(48);
    expect(JSON.stringify(anon.standings)).not.toMatch(/17|48|42/);

    const asAlice = await getPublicState(db, group.id, alice.token);
    expect(asAlice.own?.alias).toBe("נועה");
    expect(asAlice.own?.breakdown?.rank).toBe(1);
    expect(asAlice.own?.prediction.map((party) => party.seats)).not.toContain(17);
    expect(asAlice.own?.prediction.map((party) => party.seats)).not.toContain(48);
    expect(asAlice.own?.prediction.find((party) => party.partyId === a.id)?.seats).toBe(50);
    expect(asAlice.standings.find((row) => row.isYou)?.alias).toBe("נועה");
    expect(JSON.stringify(asAlice.standings)).not.toMatch(/17|48/);

    const asCarol = await getPublicState(db, group.id, carol.token);
    expect(asCarol.own?.prediction.find((party) => party.partyId === a.id)?.seats).toBe(17);
    expect(asCarol.own?.breakdown?.parties.find((party) => party.partyId === a.id)).toMatchObject({
      predicted: 17,
      actual: 50,
      diff: -33,
    });
    expect(JSON.stringify(asCarol.standings)).not.toContain("17");
    expect(asCarol.own?.prediction.map((party) => party.seats)).not.toContain(48);

    const adminRows = await listParticipantsAdmin(db, group.id);
    expect(adminRows).toHaveLength(3);
    for (const row of adminRows) {
      expect(Object.keys(row).sort()).toEqual(["alias", "complete", "joinedAt"]);
      expect(row.complete).toBe(true);
    }
    expect(JSON.stringify(adminRows)).not.toContain("17");
  });

  it("locks bets after the deadline and keeps them private", async () => {
    const db = await memory();
    const group = await createGroup(db, "נעילה", "2020-01-01T00:00:00.000Z");
    await expect(joinGroup(db, group.id, "מאוחר")).rejects.toThrow(/נעול/);
    const open = await createGroup(db, "פתוח");
    const person = await joinGroup(db, open.id, "שחר");
    const parties = await listParties(db, open.id);
    const seats: Record<string, number> = {};
    parties.forEach((party, index) => {
      seats[party.id] = index === 0 ? 120 : 0;
    });
    await savePrediction(db, open.id, person.token, seats);
    const { updateGroup } = await import("./game");
    await updateGroup(db, open.id, { deadline: "2020-01-01T00:00:00.000Z" });
    await expect(savePrediction(db, open.id, person.token, seats)).rejects.toThrow(/נעול/);
    const state = await getPublicState(db, open.id, null);
    expect(state.group.locked).toBe(true);
    expect(JSON.stringify(state)).not.toContain('"seats":120');
  });

  it("refreshes official results on a timer and skips a manual override", async () => {
    const db = await memory();
    const group = await createGroup(db, "ספירה");
    const parties = await listParties(db, group.id);
    let calls = 0;
    const fetcher = async (): Promise<{ ok: true; parsed: ParsedResults; url: string }> => {
      calls += 1;
      const votes = parties.map((party, index) => (index === 0 ? 1000 : 0));
      return {
        ok: true,
        url: "https://votes26.bechirot.gov.il/nationalresults",
        parsed: {
          status: "provisional",
          countedPercent: 40,
          turnoutPercent: 20,
          eligibleVoters: 7000000,
          ballotsCast: 1400000,
          validVotes: 1000,
          invalidVotes: 0,
          format: "test",
          lists: parties.map((party, index) => ({
            name: party.name,
            ballot: party.ballot,
            votes: votes[index],
            officialSeats: null,
            votePercent: null,
          })),
        },
      };
    };

    const first = await ensureFreshResults(db, group.id, { fetcher, now: new Date("2026-10-27T18:00:00.000Z") });
    expect(first.refreshed).toBe(true);
    expect(calls).toBe(1);
    const state = await getPublicState(db, group.id, null);
    expect(state.results?.status).toBe("provisional");
    expect(state.results?.countedPercent).toBe(40);
    expect(state.results?.seatMethod).toBe("bader-ofer");
    expect(state.results?.scoreable).toBe(true);
    expect(state.results?.parties.find((party) => party.ballot === "מחל")?.seats).toBe(120);

    const second = await ensureFreshResults(db, group.id, {
      fetcher,
      now: new Date("2026-10-27T18:01:00.000Z"),
    });
    expect(second.refreshed).toBe(false);
    expect(calls).toBe(1);

    const manual: Record<string, number> = {};
    parties.forEach((party, index) => {
      manual[party.id] = index === 1 ? 120 : 0;
    });
    await saveManualResults(db, group.id, {
      seatsByPartyId: manual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });
    const blocked = await ensureFreshResults(db, group.id, {
      fetcher,
      force: true,
      now: new Date("2026-10-27T19:00:00.000Z"),
    });
    expect(blocked.refreshed).toBe(false);
    expect(calls).toBe(1);
    const after = await getPublicState(db, group.id, null);
    expect(after.results?.source).toBe("manual");
    expect(after.results?.parties.find((party) => party.ballot === "רק")?.seats).toBe(120);
  });
});
