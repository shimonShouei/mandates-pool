import {
  KNESSET_SEATS,
  THRESHOLD_DENOMINATOR,
  THRESHOLD_NUMERATOR,
  passesElectoralThreshold,
} from "../seats";

export type AllocationList = { id: string; votes: number };
export type SurplusAgreement = { a: string; b: string };

export type IgnoredAgreement = SurplusAgreement & {
  reason: "below-threshold" | "unknown-list" | "duplicate";
};

export type Allocation = {
  seats: Record<string, number>;
  passed: Record<string, boolean>;
  ignoredAgreements: IgnoredAgreement[];
  measure: number;
  initialSeats: Record<string, number>;
  remainderSeats: number;
};

type Candidate = { id: string; votes: number; seats: number };

/**
 * Israeli Knesset seat allocation (Bader-Ofer), סעיף 81 לחוק הבחירות לכנסת.
 *
 * 1. Drop lists under 3.25% of all valid votes.
 * 2. The measure is the integer quotient of qualifying votes / 120.
 * 3. Each qualifying list gets floor(votes / measure) seats on its own.
 * 4. Leftover seats go one at a time to the highest votes/(seats+1).
 *    A surplus agreement competes as one pool (combined votes and seats).
 *    The seat it wins is given to the partner with the higher individual quotient.
 *    An agreement is void if either partner missed the threshold.
 *
 * Ties break toward more votes, then a stable id. The statute uses a lottery
 * for a true tie; that does not affect the 2022 result.
 */
export function allocateBaderOfer(input: {
  lists: AllocationList[];
  agreements?: SurplusAgreement[];
  validVotes?: number;
  totalSeats?: number;
}): Allocation {
  const totalSeats = input.totalSeats ?? KNESSET_SEATS;
  const agreements = input.agreements ?? [];
  for (const list of input.lists) {
    if (!Number.isInteger(list.votes) || list.votes < 0) {
      throw new Error(`Vote counts must be non-negative integers (got ${list.votes} for ${list.id}).`);
    }
  }

  const validVotes = input.validVotes ?? input.lists.reduce((sum, list) => sum + list.votes, 0);
  const passed: Record<string, boolean> = {};
  const qualifying: AllocationList[] = [];
  for (const list of input.lists) {
    const ok = passesElectoralThreshold(list.votes, validVotes);
    passed[list.id] = ok;
    if (ok) qualifying.push(list);
  }

  const known = new Set(input.lists.map((list) => list.id));
  const passedIds = new Set(qualifying.map((list) => list.id));
  const ignoredAgreements: IgnoredAgreement[] = [];
  const active: SurplusAgreement[] = [];
  const paired = new Set<string>();
  for (const agreement of agreements) {
    if (!known.has(agreement.a) || !known.has(agreement.b) || agreement.a === agreement.b) {
      ignoredAgreements.push({ ...agreement, reason: "unknown-list" });
      continue;
    }
    if (!passedIds.has(agreement.a) || !passedIds.has(agreement.b)) {
      ignoredAgreements.push({ ...agreement, reason: "below-threshold" });
      continue;
    }
    if (paired.has(agreement.a) || paired.has(agreement.b)) {
      ignoredAgreements.push({ ...agreement, reason: "duplicate" });
      continue;
    }
    paired.add(agreement.a);
    paired.add(agreement.b);
    active.push(agreement);
  }

  const seats: Record<string, number> = {};
  const initialSeats: Record<string, number> = {};
  for (const list of input.lists) {
    seats[list.id] = 0;
    initialSeats[list.id] = 0;
  }

  const qualifyingVotes = qualifying.reduce((sum, list) => sum + list.votes, 0);
  const measure = totalSeats > 0 ? Math.floor(qualifyingVotes / totalSeats) : 0;
  let used = 0;
  if (measure > 0) {
    for (const list of qualifying) {
      const initial = Math.floor(list.votes / measure);
      seats[list.id] = initial;
      initialSeats[list.id] = initial;
      used += initial;
    }
  }

  const voteOf = new Map(qualifying.map((list) => [list.id, list.votes]));
  while (used > totalSeats) {
    const holders = qualifying.filter((list) => seats[list.id] > 0);
    let worst = holders[0];
    for (const list of holders.slice(1)) {
      const left = BigInt(list.votes) * BigInt(seats[worst.id]);
      const right = BigInt(worst.votes) * BigInt(seats[list.id]);
      if (left < right || (left === right && list.votes < worst.votes)) worst = list;
    }
    seats[worst.id] -= 1;
    used -= 1;
  }

  while (used < totalSeats && qualifying.length > 0) {
    const candidates: (Candidate & { pair?: [string, string] })[] = [];
    for (const list of qualifying) {
      if (paired.has(list.id)) continue;
      candidates.push({ id: list.id, votes: list.votes, seats: seats[list.id] });
    }
    for (const agreement of active) {
      candidates.push({
        id: `${agreement.a}+${agreement.b}`,
        votes: voteOf.get(agreement.a)! + voteOf.get(agreement.b)!,
        seats: seats[agreement.a] + seats[agreement.b],
        pair: [agreement.a, agreement.b],
      });
    }
    const winner = pickWinner(candidates);
    if (winner.pair) {
      const [a, b] = winner.pair;
      const inner = pickWinner([
        { id: a, votes: voteOf.get(a)!, seats: seats[a] },
        { id: b, votes: voteOf.get(b)!, seats: seats[b] },
      ]);
      seats[inner.id] += 1;
    } else {
      seats[winner.id] += 1;
    }
    used += 1;
  }

  return {
    seats,
    passed,
    ignoredAgreements,
    measure,
    initialSeats,
    remainderSeats: Math.max(0, totalSeats - Object.values(initialSeats).reduce((sum, value) => sum + value, 0)),
  };
}

function pickWinner<T extends Candidate>(candidates: T[]): T {
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    const left = BigInt(candidate.votes) * BigInt(best.seats + 1);
    const right = BigInt(best.votes) * BigInt(candidate.seats + 1);
    if (
      left > right ||
      (left === right &&
        (candidate.votes > best.votes || (candidate.votes === best.votes && candidate.id < best.id)))
    ) {
      best = candidate;
    }
  }
  return best;
}

export { passesElectoralThreshold, THRESHOLD_NUMERATOR, THRESHOLD_DENOMINATOR };
