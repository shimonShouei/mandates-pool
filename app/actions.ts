"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeEqual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  GameError,
  addAgreement,
  addParty,
  applyParsedResults,
  clearOverride,
  createGroup,
  deleteParticipation,
  deleteParty,
  getGroupByCode,
  joinGroup,
  listParties,
  markUploaded,
  moveParty,
  removeAgreement,
  saveManualResults,
  savePrediction,
  updateGroup,
  updateParty,
} from "@/lib/game";
import { parseCecPayload } from "@/lib/results/parse-cec";
import { ensureFreshResults } from "@/lib/refresh";
import { clearAdminCookie, clearToken, isAdmin, readToken, setAdminCookie, writeToken } from "@/lib/session";
import { jerusalemLocalToIso } from "@/lib/time";

export type ActionResult = { ok: true; warnings?: string[] } | { ok: false; error: string };

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
  if (!(await isAdmin())) throw new GameError("נדרשת כניסת מנהל.");
}

function paths(code: string) {
  revalidatePath(`/g/${code}`);
  revalidatePath(`/admin/${code}`);
  revalidatePath("/admin");
}

export async function goToCode(formData: FormData) {
  const code = String(formData.get("code") || "").trim();
  if (!code) return;
  redirect(`/g/${encodeURIComponent(code)}`);
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

export async function createGroupAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = await getDb();
    const name = String(formData.get("name") || "ניחוש הכנסת ה-26");
    const deadlineRaw = String(formData.get("deadline") || "");
    const deadline = deadlineRaw ? jerusalemLocalToIso(deadlineRaw) : null;
    if (deadlineRaw && !deadline) return { ok: false, error: "שעת הנעילה לא תקינה." };
    const group = await createGroup(db, name, deadline);
    paths(group.code);
    redirect(`/admin/${group.code}`);
  } catch (error) {
    return fail(error);
  }
}

export async function updateGroupAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const deadlineRaw = String(formData.get("deadline") || "");
    const clearDeadline = formData.get("clearDeadline") === "1";
    const deadline = clearDeadline ? null : deadlineRaw ? jerusalemLocalToIso(deadlineRaw) : group.deadline;
    if (deadlineRaw && !clearDeadline && !deadline) return { ok: false, error: "שעת הנעילה לא תקינה." };
    const knesset = Number(formData.get("knesset") || group.knessetNumber);
    await updateGroup(db, group.id, {
      name: String(formData.get("name") || group.name),
      deadline,
      knessetNumber: knesset,
      preferComputed: formData.get("preferComputed") === "1",
    });
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function lockNow(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    await updateGroup(db, group.id, { deadline: new Date().toISOString() });
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function savePartyAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
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
    if (partyId) await updateParty(db, group.id, partyId, input);
    else await addParty(db, group.id, input);
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePartyAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    await deleteParty(db, group.id, String(formData.get("partyId") || ""));
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function movePartyAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const direction = Number(formData.get("direction")) === -1 ? -1 : 1;
    await moveParty(db, group.id, String(formData.get("partyId") || ""), direction);
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addAgreementAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    await addAgreement(db, group.id, String(formData.get("partyA") || ""), String(formData.get("partyB") || ""));
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeAgreementAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    await removeAgreement(db, group.id, String(formData.get("agreementId") || ""));
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function assignUnmappedAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const ballot = String(formData.get("ballot") || "").trim();
    const sourceName = String(formData.get("sourceName") || "").trim();
    const partyId = String(formData.get("partyId") || "");
    const parties = await listParties(db, group.id);
    if (partyId === "__new") {
      await addParty(db, group.id, {
        name: sourceName || ballot || "רשימה",
        ballot,
        color: "#57534e",
        matchKeys: [sourceName, ballot].filter(Boolean),
      });
    } else {
      const party = parties.find((item) => item.id === partyId);
      if (!party) return { ok: false, error: "הרשימה לא נמצאה." };
      const matchKeys = [...new Set([...party.matchKeys, ballot, sourceName].filter(Boolean))];
      await updateParty(db, group.id, party.id, {
        name: party.name,
        ballot: party.ballot || ballot,
        color: party.color,
        matchKeys,
      });
    }
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadResultsAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "בחרו קובץ HTML או JSON של דף התוצאות." };
    if (file.size > 2_000_000) return { ok: false, error: "הקובץ גדול מדי (עד 2MB)." };
    const parsed = parseCecPayload(await file.text());
    if (!parsed) return { ok: false, error: "לא זיהינו בקובץ טבלת רשימות של ועדת הבחירות." };
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    await applyParsedResults(db, group.id, parsed, { source: "upload", sourceUrl: file.name });
    await markUploaded(db, group.id);
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveManualAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const parties = await listParties(db, group.id);
    const seatsByPartyId: Record<string, number> = {};
    const votesByPartyId: Record<string, number | null> = {};
    for (const party of parties) {
      seatsByPartyId[party.id] = Number(formData.get(`seats_${party.id}`) || 0);
      const votesRaw = String(formData.get(`votes_${party.id}`) || "").trim();
      votesByPartyId[party.id] = votesRaw === "" ? null : Number(votesRaw);
    }
    const countedRaw = String(formData.get("countedPercent") || "").trim();
    const turnoutRaw = String(formData.get("turnoutPercent") || "").trim();
    await saveManualResults(db, group.id, {
      seatsByPartyId,
      votesByPartyId,
      computeFromVotes: formData.get("computeFromVotes") === "1",
      status: formData.get("status") === "final" ? "final" : "provisional",
      countedPercent: countedRaw === "" ? null : Number(countedRaw),
      turnoutPercent: turnoutRaw === "" ? null : Number(turnoutRaw),
    });
    paths(group.code);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function refreshOfficialAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    const result = await ensureFreshResults(db, group.id, { force: true, overrideManual: true });
    paths(group.code);
    if (!result.refreshed) return { ok: false, error: result.error ?? "לא הצלחנו לרענן." };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function resumeAutoAction(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") || "");
  try {
    await requireAdmin();
    const db = await getDb();
    const group = await getGroupByCode(db, code);
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה." };
    await clearOverride(db, group.id);
    const result = await ensureFreshResults(db, group.id, { force: true });
    paths(group.code);
    if (!result.refreshed) return { ok: false, error: result.error ?? "העקיפה בוטלה, אבל הרענון מהוועדה נכשל." };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
