import { describe, expect, it } from "vitest";
import { publicGroupFields, readGroupBoard, readGroupCrowd, readSiteCrowd } from "./board-cache";
import { createSqliteDb } from "./db";
import {
  createGroup,
  deleteParticipation,
  getPublicState,
  joinGroup,
  listParticipantsAdmin,
  listVisibilityLog,
  saveManualResults,
  savePrediction,
  setBetVisibility,
  updateGroup,
} from "./game";
import { backfillBetVersions } from "./legacy-migrate";
import { globalLeaderboard } from "./leaderboard";
import type { PublicGroupState } from "./public-state";
import { pollsOpenIso } from "./time";

const OPEN_UNTIL = pollsOpenIso("2099-01-01");

function vector(parties: { id: string }[], first: number, second: number) {
  const seats: Record<string, number> = {};
  parties.forEach((party, index) => {
    seats[party.id] = index === 0 ? first : index === 1 ? second : 0;
  });
  return seats;
}

function seesSeat(state: PublicGroupState, seat: number) {
  const inOwn =
    state.own?.prediction.some((row) => row.seats === seat) ||
    state.own?.history.some((revision) => revision.changes.some((change) => change.before === seat || change.after === seat));
  const inOthers = state.revealed?.some(
    (person) =>
      person.prediction.some((row) => row.seats === seat) ||
      person.history.some((revision) => revision.changes.some((change) => change.before === seat || change.after === seat)),
  );
  return Boolean(inOwn || inOthers);
}

describe("group visibility", () => {
  it("keeps other people's bets hidden until the group is open and the rule says so", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listPartiesSafe(db);
    const group = await createGroup(db, "שקיפות", null, OPEN_UNTIL, "owner-1");
    const alice = await joinGroup(db, group.id, "נועה");
    const bob = await joinGroup(db, group.id, "עידו");
    await savePrediction(db, group.id, alice.token, vector(parties, 77, 43), 1_000);
    await savePrediction(db, group.id, alice.token, vector(parties, 70, 50), 2_000);

    const hidden = await getPublicState(db, group.id, bob.token);
    expect(hidden.group.visibility).toBe("anonymous");
    expect(hidden.revealed).toBeNull();
    expect(seesSeat(hidden, 77)).toBe(false);
    expect(hidden.own?.history).toEqual([]);

    const own = await getPublicState(db, group.id, alice.token);
    expect(own.own?.history).toHaveLength(2);
    expect(own.own?.history[1].changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ before: 77, after: 70 })]),
    );
    expect(JSON.stringify(own)).not.toContain("@");

    await expect(
      setBetVisibility(db, group.id, group.adminToken, "owner-1", { visibility: "open", revealBeforeLock: false }, false),
    ).rejects.toThrow(/אישור/);
    await setBetVisibility(db, group.id, null, "owner-1", { visibility: "open", revealBeforeLock: false }, true, 3_000);

    const beforeLock = await getPublicState(db, group.id, bob.token);
    expect(beforeLock.group.visibility).toBe("open");
    expect(beforeLock.revealed).toBeNull();
    expect(seesSeat(beforeLock, 77)).toBe(false);

    await setBetVisibility(db, group.id, group.adminToken, null, { visibility: "open", revealBeforeLock: true }, true, 4_000);
    const early = await getPublicState(db, group.id, bob.token);
    expect(early.revealed?.find((person) => person.alias === "נועה")?.prediction.some((row) => row.seats === 77)).toBe(false);
    expect(early.revealed?.find((person) => person.alias === "נועה")?.prediction.some((row) => row.seats === 70)).toBe(true);
    expect(early.revealed?.find((person) => person.alias === "נועה")?.history[1].changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ before: 77, after: 70 })]),
    );
    expect(seesSeat(await getPublicState(db, group.id, null), 70)).toBe(false);

    await setBetVisibility(db, group.id, group.adminToken, "owner-1", { visibility: "open", revealBeforeLock: false }, false, 5_000);
    await updateGroup(db, group.id, { deadline: "2020-01-01T00:00:00.000Z" });
    const opened = await getPublicState(db, group.id, bob.token);
    expect(opened.group.locked).toBe(true);
    expect(opened.revealed?.find((person) => person.alias === "נועה")?.history).toHaveLength(2);
    expect(seesSeat(opened, 70)).toBe(true);
    const stranger = await getPublicState(db, group.id, null);
    expect(stranger.revealed).toBeNull();
    expect(seesSeat(stranger, 70)).toBe(false);
    expect(seesSeat(stranger, 77)).toBe(false);
    const admin = await getPublicState(db, group.id, null, null, true);
    expect(admin.revealed?.some((person) => person.prediction.some((row) => row.seats === 70))).toBe(true);

    await expect(
      setBetVisibility(db, group.id, group.adminToken, "owner-1", { visibility: "anonymous", revealBeforeLock: false }, true),
    ).rejects.toThrow(/נעילה/);
    await expect(
      setBetVisibility(db, group.id, null, null, { visibility: "anonymous", revealBeforeLock: false }, true),
    ).rejects.toThrow(/ניהול/);

    const log = await listVisibilityLog(db, group.id);
    expect(log.map((row) => row.toVisibility)).toEqual(["open", "open", "open"]);
    expect(log.map((row) => row.toRevealBeforeLock)).toEqual([false, true, false]);
    expect(log[0].via).toBe("account");
    expect(log[1].via).toBe("backup");

    const actual: Record<string, number> = {};
    parties.forEach((party, index) => {
      actual[party.id] = index === 0 ? 70 : index === 1 ? 50 : 0;
    });
    await saveManualResults(db, {
      seatsByPartyId: actual,
      votesByPartyId: {},
      computeFromVotes: false,
      status: "final",
      countedPercent: 100,
      turnoutPercent: null,
    });
    const standings = publicGroupFields(await readGroupBoard(db, group.id));
    expect(standings).not.toHaveProperty("revealed");
    expect(standings.standings.some((row) => row.alias === "נועה")).toBe(true);
    expect(standings.standings.every((row) => !("prediction" in row) && !("diffs" in row))).toBe(true);
    const crowd = await readGroupCrowd(db, group.id);
    expect(crowd.visible).toBe(false);
    expect(crowd.parties).toEqual([]);
    expect((await readSiteCrowd(db)).parties).toEqual([]);
    const national = await globalLeaderboard(db);
    expect(national.rows.some((row) => row.alias === "נועה")).toBe(true);
    expect(national.rows.every((row) => !("prediction" in row) && !("seats" in row))).toBe(true);
    expect(seesSeat(await getPublicState(db, group.id, null), 70)).toBe(false);
    const adminRows = await listParticipantsAdmin(db, group.id);
    expect(Object.keys(adminRows[0]).sort()).toEqual(["alias", "complete", "joinedAt", "paid"]);
    expect(adminRows.some((row) => Object.values(row).includes(70 as never))).toBe(false);
  });

  it("rebuilds a version for a bet saved before history existed, and drops history when someone leaves", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listPartiesSafe(db);
    const group = await createGroup(db, "גרסאות", null, OPEN_UNTIL);
    const person = await joinGroup(db, group.id, "תמר");
    await savePrediction(db, group.id, person.token, vector(parties, 77, 43));
    await db.run(`DELETE FROM bet_versions`);
    await backfillBetVersions(db);
    const restored = await db.get<{ seats: string }>(`SELECT seats FROM bet_versions WHERE participant_id = ?`, [
      person.participantId,
    ]);
    expect(JSON.parse(restored?.seats || "{}")[parties[0].id]).toBe(77);
    await backfillBetVersions(db);
    const count = await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM bet_versions WHERE participant_id = ?`, [
      person.participantId,
    ]);
    expect(Number(count?.c)).toBe(1);

    await deleteParticipation(db, group.id, person.token);
    const left = await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM bet_versions WHERE participant_id = ?`, [
      person.participantId,
    ]);
    expect(Number(left?.c)).toBe(0);
    expect(seesSeat(await getPublicState(db, group.id, null, null, true), 77)).toBe(false);
  });
});

async function listPartiesSafe(db: Awaited<ReturnType<typeof createSqliteDb>>) {
  const { listParties } = await import("./game");
  return listParties(db);
}
