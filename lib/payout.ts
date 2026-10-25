export const WINNER_TAKES_ALL = [100];

export const STAKE_NOTE =
  "הקופה לתצוגה בלבד. האתר לא גובה, לא מחזיק ולא מעביר כסף. מסדרים את זה בין החברים.";

export type GroupStake = {
  buyInAgorot: number;
  potAgorot: number;
  split: number[];
};

export function splitLabel(split: number[]): string {
  if (split.length === 1 && split[0] === 100) return "המנצח לוקח הכל";
  return split.join("/");
}

/** Whole shekels or up to two decimal places, stored as agorot. 0 means no stake. */
export function parseStakeIls(raw: string): number {
  const text = raw.trim().replace(",", ".");
  if (!text) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("סכום ההשתתפות צריך להיות מספר שקלים, עד שתי ספרות אחרי הנקודה.");
  }
  const shekels = Number(text);
  if (shekels > 100_000) throw new Error("סכום ההשתתפות יכול להיות עד 100000 שקלים.");
  return Math.round(shekels * 100);
}

/** Percents such as 100 or 60/30/10. They must be positive integers that sum to 100. */
export function parsePayoutSplit(raw: string): number[] {
  const parts = raw
    .trim()
    .split(/[/,\s]+/)
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 8) {
    throw new Error("החלוקה היא אחוזים שסכומם 100, למשל 100 או 60/30/10.");
  }
  const split = parts.map((part) => Number(part));
  if (split.some((part) => !Number.isInteger(part) || part <= 0 || part > 100)) {
    throw new Error("כל חלק בחלוקה צריך להיות אחוז שלם בין 1 ל-100.");
  }
  if (split.reduce((sum, part) => sum + part, 0) !== 100) {
    throw new Error("חלקי החלוקה צריכים להסתכם ל-100.");
  }
  return split;
}

export function parseStoredSplit(raw: string | null | undefined): number[] {
  try {
    return parsePayoutSplit(raw || "100");
  } catch {
    return WINNER_TAKES_ALL;
  }
}

/** Largest-remainder split of an integer total. Unused percent stays unallocated. */
export function allocateByPercent(total: number, percents: number[]): number[] {
  const exact = percents.map((part) => (total * part) / 100);
  const amounts = exact.map((value) => Math.floor(value));
  const target = Math.floor((total * percents.reduce((sum, part) => sum + part, 0)) / 100);
  const left = target - amounts.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let step = 0; step < left; step += 1) amounts[order[step].index] += 1;
  return amounts;
}

export type PayoutFinisher = { id: string; rank: number };

/**
 * Pot is the buy-in times every participant.
 * Tied ranks split the prize places they occupy, evenly, in stable id order.
 * An extra agora goes to the earlier id. Places with nobody are not paid.
 */
export function computeWinnings(input: {
  buyInAgorot: number;
  participantCount: number;
  split: number[];
  finishers: PayoutFinisher[];
}): { potAgorot: number; byId: Map<string, number> } {
  const potAgorot = input.buyInAgorot * input.participantCount;
  const byId = new Map<string, number>();
  const ordered = [...input.finishers].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  for (const person of ordered) byId.set(person.id, 0);
  if (potAgorot === 0 || ordered.length === 0) return { potAgorot, byId };

  const places = allocateByPercent(potAgorot, input.split);
  let cursor = 0;
  let index = 0;
  while (index < ordered.length && cursor < places.length) {
    const rank = ordered[index].rank;
    const group: PayoutFinisher[] = [];
    while (index < ordered.length && ordered[index].rank === rank) {
      group.push(ordered[index]);
      index += 1;
    }
    const pool = places.slice(cursor, cursor + group.length).reduce((sum, value) => sum + value, 0);
    cursor += group.length;
    const base = Math.floor(pool / group.length);
    let remainder = pool % group.length;
    for (const person of group) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      byId.set(person.id, base + extra);
    }
  }
  return { potAgorot, byId };
}
