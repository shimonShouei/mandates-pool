export const KNESSET_SEATS = 120;
export const THRESHOLD_PERCENT = 3.25;
/** 3.25% = 13/400. Integer comparison avoids binary-float edges. */
export const THRESHOLD_NUMERATOR = 13;
export const THRESHOLD_DENOMINATOR = 400;
/** A list that clears 3.25% cannot win fewer than 4 seats in ordinary counts. */
export const MIN_NONZERO_PREDICTION = 4;

export function passesElectoralThreshold(votes: number, validVotes: number): boolean {
  if (validVotes <= 0 || votes <= 0) return false;
  return votes * THRESHOLD_DENOMINATOR >= validVotes * THRESHOLD_NUMERATOR;
}

export type SeatCheck =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

export function checkSeatVector(seats: number[]): SeatCheck {
  const warnings: string[] = [];
  if (seats.some((value) => !Number.isInteger(value))) {
    return { ok: false, error: "מנדטים חייבים להיות מספרים שלמים.", warnings };
  }
  if (seats.some((value) => value < 0)) {
    return { ok: false, error: "אי אפשר לרשום מספר מנדטים שלילי.", warnings };
  }
  if (seats.some((value) => value > KNESSET_SEATS)) {
    return { ok: false, error: `אי אפשר לתת לרשימה יותר מ-${KNESSET_SEATS} מנדטים.`, warnings };
  }
  const sum = seats.reduce((total, value) => total + value, 0);
  if (sum !== KNESSET_SEATS) {
    return { ok: false, error: seatSumError(sum), warnings };
  }
  if (seats.some((value) => value > 0 && value < MIN_NONZERO_PREDICTION)) {
    warnings.push(
      `ערך בין 1 ל-3 אינו אפשרי: מי שעובר את אחוז החסימה (${THRESHOLD_PERCENT}%) מקבל לפחות ${MIN_NONZERO_PREDICTION} מנדטים, ומי שלא עובר מקבל 0.`,
    );
  }
  return { ok: true, warnings };
}

export function seatSumError(sum: number): string {
  return `סך המנדטים חייב להיות בדיוק ${KNESSET_SEATS} (כרגע ${sum})`;
}

/** A typed or stepped seat stays inside 0..120. Values already stored are left for the caller to show. */
export function clampSeat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const whole = Math.trunc(value);
  if (whole < 0) return 0;
  if (whole > KNESSET_SEATS) return KNESSET_SEATS;
  return whole;
}

export function seatWarningForParty(name: string, seats: number): string | null {
  if (!Number.isInteger(seats) || seats <= 0 || seats >= MIN_NONZERO_PREDICTION) return null;
  return `${name}: ${seats} מנדטים אינם אפשריים. מתחת לאחוז החסימה רושמים 0, ומעליו לפחות ${MIN_NONZERO_PREDICTION}.`;
}
