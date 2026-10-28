import { describe, expect, it } from "vitest";
import { claimCookieParticipant, claimGroupOwner, createAccount, listMyGroups } from "./accounts";
import { createAuthAdapter } from "./auth-adapter";
import { createSqliteDb } from "./db";
import {
  createGroup,
  getPublicState,
  isGroupAdmin,
  joinGroup,
  listParticipantsAdmin,
  listParties,
  participantFromUser,
  savePrediction,
  savePredictionForUser,
  updateGroup,
  updateGroupAsAdmin,
} from "./game";
import { globalLeaderboard } from "./leaderboard";
import { pollsOpenIso } from "./time";

const OPEN_UNTIL = pollsOpenIso("2099-01-01");
const EMAIL_A = "secret-owner@example.com";
const EMAIL_B = "other-person@example.com";

function vector(parties: { id: string }[], first: number, second: number) {
  const seats: Record<string, number> = {};
  parties.forEach((party, index) => {
    seats[party.id] = index === 0 ? first : index === 1 ? second : 0;
  });
  return seats;
}

function ownSeat(state: Awaited<ReturnType<typeof getPublicState>>, partyId: string) {
  return state.own?.prediction.find((row) => row.partyId === partyId)?.seats;
}

describe("account bet access", () => {
  it("lets an account read and edit only its own bet", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listParties(db);
    const group = await createGroup(db, "חשבונות", null, OPEN_UNTIL);
    const alice = await createAccount(db, EMAIL_A);
    const bob = await createAccount(db, EMAIL_B);
    const joined = await joinGroup(db, group.id, "נועה", Date.now(), alice.id);
    await savePredictionForUser(db, group.id, alice.id, vector(parties, 77, 43));

    await expect(savePredictionForUser(db, group.id, bob.id, vector(parties, 10, 110))).rejects.toThrow(/אין לכם/);
    await expect(savePrediction(db, group.id, joined.token, vector(parties, 10, 110))).rejects.toThrow(/דפדפן/);
    await expect(joinGroup(db, group.id, "נועה אחרת", Date.now(), alice.id)).rejects.toThrow(/כבר/);

    const asAlice = await getPublicState(db, group.id, joined.token, alice.id);
    const asBob = await getPublicState(db, group.id, joined.token, bob.id);
    expect(ownSeat(asAlice, parties[0].id)).toBe(77);
    expect(asBob.own).toBeNull();
    expect(JSON.stringify(asBob.own)).not.toContain("77");
    expect(JSON.stringify(asBob.standings)).not.toContain(EMAIL_A);
    expect(JSON.stringify(asAlice)).not.toContain(EMAIL_A);
    expect(JSON.stringify(await listParticipantsAdmin(db, group.id))).not.toContain(EMAIL_A);
    expect(JSON.stringify(await globalLeaderboard(db, { pageSize: 20 }))).not.toContain(EMAIL_A);

    const second = await createGroup(db, "קבוצה שנייה", null, OPEN_UNTIL);
    await joinGroup(db, second.id, "דנה", Date.now(), alice.id);
    await savePredictionForUser(db, second.id, alice.id, vector(parties, 12, 108));
    const mine = await listMyGroups(db, alice.id);
    expect(mine.map((row) => row.alias).sort()).toEqual(["דנה", "נועה"]);
    expect(JSON.stringify(mine)).not.toContain(EMAIL_A);
    expect(ownSeat(await getPublicState(db, second.id, null, alice.id), parties[0].id)).toBe(12);
    expect(ownSeat(await getPublicState(db, group.id, null, alice.id), parties[0].id)).toBe(77);
    expect(await participantFromUser(db, group.id, bob.id)).toBeNull();
  });

  it("lists groups the account owns and groups it only bets in", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listParties(db);
    const alice = await createAccount(db, EMAIL_A);
    const managed = await createGroup(db, "רק ניהול", null, OPEN_UNTIL, alice.id);
    await updateGroup(db, managed.id, { stakeAgorot: 2000 });
    const both = await createGroup(db, "גם מהמר", null, OPEN_UNTIL, alice.id);
    await joinGroup(db, both.id, "נועה", Date.now(), alice.id);
    await savePredictionForUser(db, both.id, alice.id, vector(parties, 120, 0));
    const played = await createGroup(db, "של מישהו", null, OPEN_UNTIL);
    await joinGroup(db, played.id, "דנה", Date.now(), alice.id);

    const mine = await listMyGroups(db, alice.id);
    const byName = Object.fromEntries(mine.map((row) => [row.name, row]));
    expect(byName["רק ניהול"]).toMatchObject({
      owned: true,
      alias: null,
      betSubmitted: false,
      stakeAgorot: 2000,
      participants: 0,
    });
    expect(byName["גם מהמר"]).toMatchObject({
      owned: true,
      alias: "נועה",
      betSubmitted: true,
      participants: 1,
    });
    expect(byName["של מישהו"]).toMatchObject({
      owned: false,
      alias: "דנה",
      betSubmitted: false,
      participants: 1,
    });
    expect(JSON.stringify(mine)).not.toContain(EMAIL_A);
  });

  it("claims a device bet on sign-in and leaves the old token dead", async () => {
    const db = await createSqliteDb(":memory:");
    const parties = await listParties(db);
    const group = await createGroup(db, "ישן", null, OPEN_UNTIL);
    const legacy = await joinGroup(db, group.id, "עידו");
    await savePrediction(db, group.id, legacy.token, vector(parties, 77, 43));
    const alice = await createAccount(db, EMAIL_A);
    const bob = await createAccount(db, EMAIL_B);

    expect(await claimCookieParticipant(db, group.id, legacy.token, alice.id)).toBe("claimed");
    expect(await claimCookieParticipant(db, group.id, legacy.token, bob.id)).toBe("skipped");
    await expect(savePrediction(db, group.id, legacy.token, vector(parties, 1, 119))).rejects.toThrow(/דפדפן/);
    await expect(savePredictionForUser(db, group.id, bob.id, vector(parties, 1, 119))).rejects.toThrow(/אין לכם/);
    expect(ownSeat(await getPublicState(db, group.id, legacy.token, null), parties[0].id)).toBeUndefined();
    expect(ownSeat(await getPublicState(db, group.id, null, alice.id), parties[0].id)).toBe(77);

    const other = await createGroup(db, "שני", null, OPEN_UNTIL);
    const parked = await joinGroup(db, other.id, "כבר שלי");
    await joinGroup(db, other.id, "חשבון", Date.now(), alice.id);
    expect(await claimCookieParticipant(db, other.id, parked.token, alice.id)).toBe("skipped");
    expect(ownSeat(await getPublicState(db, other.id, parked.token, null), parties[0].id) ?? 0).toBe(0);
    expect((await participantFromUser(db, other.id, alice.id))?.display_name).toBe("חשבון");
  });

  it("ties group admin to the creator account and keeps the backup link", async () => {
    const db = await createSqliteDb(":memory:");
    const alice = await createAccount(db, EMAIL_A);
    const bob = await createAccount(db, EMAIL_B);
    const owned = await createGroup(db, "של נועה", null, OPEN_UNTIL, alice.id);
    expect(await isGroupAdmin(db, owned.id, null, alice.id)).toBe(true);
    expect(await isGroupAdmin(db, owned.id, null, bob.id)).toBe(false);
    expect(await isGroupAdmin(db, owned.id, owned.adminToken, bob.id)).toBe(true);
    await expect(updateGroupAsAdmin(db, owned.id, null, { name: "לא" }, bob.id)).rejects.toThrow(/ניהול/);
    await updateGroupAsAdmin(db, owned.id, null, { name: "כן" }, alice.id);

    const legacy = await createGroup(db, "בלי חשבון", null, OPEN_UNTIL);
    expect(await claimGroupOwner(db, legacy.id, legacy.adminToken, alice.id)).toBe(true);
    expect(await claimGroupOwner(db, legacy.id, legacy.adminToken, bob.id)).toBe(false);
    expect(await isGroupAdmin(db, legacy.id, null, alice.id)).toBe(true);
    expect(await isGroupAdmin(db, legacy.id, legacy.adminToken, null)).toBe(true);
    expect(await isGroupAdmin(db, legacy.id, null, bob.id)).toBe(false);
  });

  it("stores an auth user without putting the address on a public board", async () => {
    const db = await createSqliteDb(":memory:");
    const adapter = createAuthAdapter(db);
    const created = await adapter.createUser?.({
      id: "user-1",
      name: null,
      email: "Hidden.Person@example.com",
      emailVerified: null,
      image: null,
    });
    expect(created?.email).toBe("hidden.person@example.com");
    expect((await adapter.getUserByEmail?.("hidden.person@example.com"))?.id).toBe("user-1");
    const token = {
      identifier: "hidden.person@example.com",
      token: "hashed-token",
      expires: new Date(Date.now() + 60_000),
    };
    await adapter.createVerificationToken?.(token);
    expect((await adapter.useVerificationToken?.({ identifier: token.identifier, token: token.token }))?.token).toBe(
      "hashed-token",
    );
    expect(await adapter.useVerificationToken?.({ identifier: token.identifier, token: token.token })).toBeNull();
    const group = await createGroup(db, "ציבור", null, OPEN_UNTIL, "user-1");
    await joinGroup(db, group.id, "כינוי", Date.now(), "user-1");
    expect(JSON.stringify(await getPublicState(db, group.id, null, null))).not.toContain("hidden.person");
    expect(JSON.stringify(await listParticipantsAdmin(db, group.id))).toContain("כינוי");
    expect(JSON.stringify(await listParticipantsAdmin(db, group.id))).not.toContain("hidden.person");
  });
});
