import type { BetChange, BetRevision, BetVisibility } from "./public-state";

export type SeatMap = Record<string, number>;

type PartyName = { id: string; name: string; color: string };

/** Anonymous is 0. Open after the lock is 1. Open before the lock is 2. */
export function exposureLevel(visibility: BetVisibility, revealBeforeLock: boolean): number {
  if (visibility !== "open") return 0;
  return revealBeforeLock ? 2 : 1;
}

/** Members (and the group admin) see full bets only under the group's own rule. */
export function membersCanSeeBets(
  group: { visibility: BetVisibility; revealBeforeLock: boolean },
  locked: boolean,
): boolean {
  if (group.visibility !== "open") return false;
  return locked || group.revealBeforeLock;
}

export function ruleLabel(visibility: BetVisibility, revealBeforeLock: boolean): string {
  if (visibility !== "open") {
    return "אנונימית. חברי הקבוצה רואים כינוי וציון, לא את חלוקת המושבים.";
  }
  if (revealBeforeLock) return "פתוחה. חברי הקבוצה רואים את הניחוש המלא גם לפני הנעילה.";
  return "פתוחה. חברי הקבוצה רואים את הניחוש המלא אחרי הנעילה.";
}

export function visibilityNote(visibility: BetVisibility, revealBeforeLock: boolean): string {
  if (visibility === "open" && revealBeforeLock) {
    return "הקבוצה פתוחה. חברי הקבוצה רואים את הניחוש המלא ואת היסטוריית השינויים, גם לפני הנעילה. המייל נשאר פרטי.";
  }
  if (visibility === "open") {
    return "הקבוצה פתוחה. אחרי הנעילה חברי הקבוצה רואים את הניחוש המלא ואת היסטוריית השינויים. עד אז רואים רק כינוי. המייל נשאר פרטי.";
  }
  return "הקבוצה אנונימית. בדירוג רואים כינוי וציון, לא את חלוקת המושבים. כל שמירה נשמרת אצלכם בהיסטוריה. המייל נשאר פרטי.";
}

export function parseSeatJson(raw: string): SeatMap {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const seats: SeatMap = {};
    for (const [key, item] of Object.entries(value)) {
      const number = Number(item);
      if (Number.isFinite(number)) seats[key] = number;
    }
    return seats;
  } catch {
    return {};
  }
}

export function diffSeats(parties: PartyName[], previous: SeatMap | null, next: SeatMap): BetChange[] {
  const changes: BetChange[] = [];
  for (const party of parties) {
    const before = previous?.[party.id] ?? 0;
    const after = next[party.id] ?? 0;
    if (before === after) continue;
    changes.push({
      partyId: party.id,
      name: party.name,
      color: party.color,
      before,
      after,
    });
  }
  return changes;
}

export function revisionsFromVersions(
  parties: PartyName[],
  versions: { savedAt: string; seats: SeatMap }[],
): BetRevision[] {
  let previous: SeatMap | null = null;
  return versions.map((version) => {
    const changes = diffSeats(parties, previous, version.seats);
    previous = version.seats;
    return { savedAt: version.savedAt, changes };
  });
}
