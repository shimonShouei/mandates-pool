const ZONE = "Asia/Jerusalem";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(date: Date, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** Interpret a datetime-local value as Asia/Jerusalem and return an ISO instant. */
export function jerusalemLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = zonedParts(new Date(guess), ZONE);
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = zonedAsUtc - guess;
  return new Date(guess - offset).toISOString();
}

export function isoToJerusalemLocal(iso: string): string {
  const parts = zonedParts(new Date(iso), ZONE);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function isLocked(deadline: string | null, now = Date.now()): boolean {
  if (!deadline) return false;
  const time = Date.parse(deadline);
  if (Number.isNaN(time)) return false;
  return now >= time;
}

/** 26th Knesset election day. Polls open at 07:00 Asia/Jerusalem. */
export const DEFAULT_ELECTION_DAY = "2026-10-27";
export const POLLS_OPEN_LOCAL_TIME = "07:00";

export function pollsOpenIso(day = DEFAULT_ELECTION_DAY, time = POLLS_OPEN_LOCAL_TIME): string {
  const iso = jerusalemLocalToIso(`${day}T${time}`);
  if (!iso) throw new Error(`Invalid election start ${day}T${time}`);
  return iso;
}

export type LockReason = "election" | "manual";

/**
 * Bets close at polls opening. An admin deadline locks earlier when it is
 * before that instant, and cannot keep bets open after it.
 */
export function lockSchedule(electionStart: string, deadline: string | null): { lockAt: string; reason: LockReason } {
  const electionMs = Date.parse(electionStart);
  if (Number.isNaN(electionMs)) throw new Error("Invalid election start");
  const manualMs = deadline ? Date.parse(deadline) : Number.NaN;
  if (!Number.isNaN(manualMs) && manualMs < electionMs) {
    return { lockAt: new Date(manualMs).toISOString(), reason: "manual" };
  }
  return { lockAt: new Date(electionMs).toISOString(), reason: "election" };
}

export function betsLocked(electionStart: string, deadline: string | null, now = Date.now()): boolean {
  return isLocked(lockSchedule(electionStart, deadline).lockAt, now);
}
