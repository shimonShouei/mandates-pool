import { claimCookieParticipant, claimGroupOwner } from "./accounts";
import { currentUserId } from "@/auth";
import { getDb } from "./db";
import { clearToken, readGroupAdminTokens, readParticipantTokens } from "./session";

/** On the device that still holds an old bet cookie, signing in takes that bet over. */
export async function claimDeviceIdentity() {
  const userId = await currentUserId();
  if (!userId) return;
  try {
    const db = await getDb();
    const bets = await readParticipantTokens();
    for (const [groupId, token] of Object.entries(bets)) {
      const result = await claimCookieParticipant(db, groupId, token, userId);
      if (result === "claimed" || result === "already") await clearToken(groupId);
    }
    const admins = await readGroupAdminTokens();
    for (const [groupId, token] of Object.entries(admins)) {
      await claimGroupOwner(db, groupId, token, userId);
    }
  } catch (error) {
    console.error(error);
  }
}
