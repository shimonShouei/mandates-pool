"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  GameError,
  addAgreement,
  addParty,
  createBloc,
  deleteBloc,
  applyParsedResults,
  clearOverride,
  deleteParticipation,
  deleteParty,
  getGroupByCode,
  isGroupAdmin,
  joinGroup,
  listParties,
  markUploaded,
  moveParty,
  removeAgreement,
  rotateGroupAdmin,
  saveManualResults,
  savePrediction,
  setPaidAliases,
  updateBloc,
  updateGroupAsAdmin,
  updateParty,
  updateSite,
} from "@/lib/game";
import { parsePayoutSplit, parseStakeIls } from "@/lib/payout";
import { parseCecPayload } from "@/lib/results/parse-cec";
import { clientIp, createPublicGroup } from "@/lib/rate-limit";
import { ensureFreshSite } from "@/lib/refresh";
import {
  clearAdminCookie,
  clearToken,
  isAdmin,
  readGroupAdminToken,
  readToken,
  setAdminCookie,
  writeGroupAdminToken,
  writeToken,
} from "@/lib/session";
import { jerusalemLocalToIso } from "@/lib/time";

export type ActionResult =
  | { ok: true; warnings?: string[]; notice?: string }
  | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (isRedirectError(error)) throw error;
  if (error instanceof GameError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "משהו השתבש. נסו שוב." };
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
  );
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new GameError("נדרשת כניסת מנהל האתר.");
}

async function requireGroupAdmin(groupId: string) {
  const db = await getDb();
  const token = await readGroupAdminToken(groupId);
  if (!(await isGroupAdmin(db, groupId, token))) {
    throw new GameError("נדרש קישור הניהול של הקבוצה.");
  }
  return token;
}

function paths(code?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/board");
  revalidatePath("/crowd");
  revalidatePath("/admin");
  if (code) {
    revalidatePath(`/g/${code}`);
    revalidatePath(`/g/${code}/manage`);
    revalidatePath(`/g/${code}/crowd`);
  }
}

export async function goToCode(formData: FormData) {
  const code = String(formData.get("code") || "").trim();
  if (!code) return;
  redirect(`/g/${encodeURIComponent(code)}`);
}

export async function createPublicGroupAction(formData: FormData): Promise<ActionResult> {
  try {
    const db = await getDb();
    const group = await createPublicGroup(db, String(formData.get("name") || ""), clientIp(await headers()));
    await writeGroupAdminToken(group.id, group.adminToken);
    paths(group.code);
    redirect(`/g/${group.code}/manage?welcome=1`);
  } catch (error) {
    return fail(error);
  }
}

export async function claimGroupAdmin(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  const token = String(formData.get("token") || "");
  try {
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    if (!(await isGroupAdmin(db, group.id, token))) {
      return { ok: false, error: "קישור הניהול לא תואם." };
    }
    await writeGroupAdminToken(group.id, token);
    redirect(`/g/${group.code}/manage`);
  } catch (error) {
    return fail(error);
  }
}

export async function joinAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  const name = String(formData.get("name") || "");
  try {
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "לא מצאנו קבוצה עם הקוד הזה." };
    const joined = await joinGroup(db, group.id, name);
    await writeToken(group.id, joined.token);
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveBet(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    const raw = JSON.parse(String(formData.get("seats") || "{}")) as Record<string, unknown>;
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const token = await readToken(group.id);
    if (!token) return { ok: false, error: "הדפדפן הזה עוד לא משויך לכינוי. הצטרפו מחדש." };
    const saved = await savePrediction(db, group.id, token, raw);
    paths(group.code);
    return { ok: true, warnings: saved.warnings };
  } catch (error) {
    return fail(error);
  }
}

export async function leaveGroup(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const token = await readToken(group.id);
    if (!token) return { ok: false, error: "אין ניחוש שמור בדפדפן הזה." };
    await deleteParticipation(db, group.id, token);
    await clearToken(group.id);
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function loginAdmin(formData: FormData): Promise<ActionResult> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return { ok: false, error: "ADMIN_SECRET לא מוגדר בסביבה." };
  const given = String(formData.get("secret") || "");
  if (!safeEqual(secret, given)) return { ok: false, error: "הסוד לא תואם." };
  await setAdminCookie();
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminCookie();
  redirect("/admin");
}

export async function updateGroupAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const token = await requireGroupAdmin(group.id);
    const deadlineRaw = String(formData.get("deadline") || "");
    const clearDeadline = formData.get("clearDeadline") === "1";
    const deadline = clearDeadline ? null : deadlineRaw ? jerusalemLocalToIso(deadlineRaw) : group.deadline;
    if (deadlineRaw && !clearDeadline && !deadline) return { ok: false, error: "שעת הנעילה לא תקינה." };
    const electionRaw = String(formData.get("electionStart") || "");
    const electionStart = jerusalemLocalToIso(electionRaw);
    if (!electionStart) return { ok: false, error: "שעת פתיחת הקלפיות לא תקינה." };
    let stakeAgorot = group.stakeAgorot;
    let payoutSplit = group.payoutSplit;
    try {
      stakeAgorot = parseStakeIls(String(formData.get("stakeIls") ?? ""));
      const preset = String(formData.get("splitPreset") || "100");
      payoutSplit = parsePayoutSplit(preset === "custom" ? String(formData.get("splitCustom") || "") : preset);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "הקופה לא תקינה." };
    }
    await updateGroupAsAdmin(db, group.id, token, {
      name: String(formData.get("name") || group.name),
      deadline,
      electionStart,
      publicBoard: formData.get("publicBoard") === "1",
      stakeAgorot,
      payoutSplit,
    });
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function markPaidAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const token = await requireGroupAdmin(group.id);
    const paid = formData.getAll("paid").map((value) => String(value));
    await setPaidAliases(db, group.id, token, paid);
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function lockNow(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const token = await requireGroupAdmin(group.id);
    await updateGroupAsAdmin(db, group.id, token, { deadline: new Date().toISOString() });
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateSiteAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    const knesset = Number(formData.get("knesset") || 0);
    const bonusRaw = String(formData.get("thresholdBonus") ?? "").trim();
    const crowdRaw = String(formData.get("crowdMin") ?? "").trim();
    await updateSite(db, {
      knessetNumber: knesset,
      preferComputed: formData.get("preferComputed") === "1",
      thresholdBonus: bonusRaw === "" ? undefined : Number(bonusRaw),
      crowdMinBets: crowdRaw === "" ? undefined : Number(crowdRaw),
      crowdBeforeLock: formData.get("crowdBeforeLock") === "1",
    });
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function createBlocAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    await createBloc(db, String(formData.get("name") || ""));
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveBlocAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    await updateBloc(db, String(formData.get("blocId") || ""), {
      name: String(formData.get("name") || ""),
      partyIds: formData.getAll("partyId").map((value) => String(value)),
    });
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBlocAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    await deleteBloc(db, String(formData.get("blocId") || ""));
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function rotateAdminLinkAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const rotated = await rotateGroupAdmin(db, group.id);
    paths(group.code);
    const link = `/g/${rotated.code}/manage?k=${rotated.adminToken}`;
    return {
      ok: true,
      notice: `קישור ניהול חדש, מוצג פעם אחת. מי שיפתח אותו מקבל את ניהול הקבוצה: ${link}`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function savePartyAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    const input = {
      name: String(formData.get("name") || ""),
      ballot: String(formData.get("ballot") || ""),
      color: String(formData.get("color") || "#1d4e89"),
      matchKeys: String(formData.get("matchKeys") || "")
        .split(/[,،\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
    const partyId = String(formData.get("partyId") || "");
    if (partyId) await updateParty(db, partyId, input);
    else await addParty(db, input);
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePartyAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    await deleteParty(db, String(formData.get("partyId") || ""));
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function movePartyAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    const direction = Number(formData.get("direction")) === -1 ? -1 : 1;
    await moveParty(db, String(formData.get("partyId") || ""), direction);
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addAgreementAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    await addAgreement(db, String(formData.get("partyA") || ""), String(formData.get("partyB") || ""));
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeAgreementAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    await removeAgreement(db, String(formData.get("agreementId") || ""));
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function assignUnmappedAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    const ballot = String(formData.get("ballot") || "").trim();
    const sourceName = String(formData.get("sourceName") || "").trim();
    const partyId = String(formData.get("partyId") || "");
    const parties = await listParties(db);
    if (partyId === "__new") {
      await addParty(db, {
        name: sourceName || ballot || "רשימה",
        ballot,
        color: "#57534e",
        matchKeys: [sourceName, ballot].filter(Boolean),
      });
    } else {
      const party = parties.find((item) => item.id === partyId);
      if (!party) return { ok: false, error: "הרשימה לא נמצאה." };
      const matchKeys = [...new Set([...party.matchKeys, ballot, sourceName].filter(Boolean))];
      await updateParty(db, party.id, {
        name: party.name,
        ballot: party.ballot || ballot,
        color: party.color,
        matchKeys,
      });
    }
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadResultsAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "בחרו קובץ HTML או JSON של דף התוצאות." };
    if (file.size > 2_000_000) return { ok: false, error: "הקובץ גדול מדי (עד 2MB)." };
    const parsed = parseCecPayload(await file.text());
    if (!parsed) return { ok: false, error: "לא זיהינו בקובץ טבלת רשימות של ועדת הבחירות." };
    const db = await getDb();
    await applyParsedResults(db, parsed, { source: "upload", sourceUrl: file.name });
    await markUploaded(db);
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveManualAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    const parties = await listParties(db);
    const seatsByPartyId: Record<string, number> = {};
    const votesByPartyId: Record<string, number | null> = {};
    for (const party of parties) {
      seatsByPartyId[party.id] = Number(formData.get(`seats_${party.id}`) || 0);
      const votesRaw = String(formData.get(`votes_${party.id}`) || "").trim();
      votesByPartyId[party.id] = votesRaw === "" ? null : Number(votesRaw);
    }
    const countedRaw = String(formData.get("countedPercent") || "").trim();
    const turnoutRaw = String(formData.get("turnoutPercent") || "").trim();
    await saveManualResults(db, {
      seatsByPartyId,
      votesByPartyId,
      computeFromVotes: formData.get("computeFromVotes") === "1",
      status: formData.get("status") === "final" ? "final" : "provisional",
      countedPercent: countedRaw === "" ? null : Number(countedRaw),
      turnoutPercent: turnoutRaw === "" ? null : Number(turnoutRaw),
    });
    paths();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function refreshOfficialAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    const result = await ensureFreshSite(db, { force: true, overrideManual: true });
    paths();
    if (!result.refreshed) return { ok: false, error: result.error ?? "לא הצלחנו לרענן." };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function resumeAutoAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    await clearOverride(db);
    const result = await ensureFreshSite(db, { force: true });
    paths();
    if (!result.refreshed) return { ok: false, error: result.error ?? "העקיפה בוטלה, אבל הרענון מהוועדה נכשל." };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
