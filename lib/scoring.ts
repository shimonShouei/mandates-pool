import { MIN_NONZERO_PREDICTION } from "./seats";

export type SeatMap = Record<string, number>;

export type PartyDiff = {
  partyId: string;
  predicted: number;
  actual: number;
  diff: number;
  passedCall: boolean;
};

export type InternalStanding = {
  participantId: string;
  alias: string;
  euclidean: number;
  absolute: number;
  misplaced: number;
  score: number;
  thresholdCorrect: number;
  rank: number;
  diffs: PartyDiff[];
};

export type PublicStanding = {
  rank: number;
  alias: string;
  absolute: number;
  misplaced: number;
  euclidean: number;
  score: number;
  thresholdCorrect: number;
  isYou: boolean;
};

/** Points removed from the absolute error for each correct pass/fail call. 0 turns the bonus off. */
export const DEFAULT_THRESHOLD_BONUS = 0.25;

export function alignVectors(partyIds: string[], predicted: SeatMap, actual: SeatMap) {
  return {
    predicted: partyIds.map((id) => predicted[id] ?? 0),
    actual: partyIds.map((id) => actual[id] ?? 0),
  };
}

/** Root of summed squared seat errors. Lower is better. Used only to break ties. */
export function euclideanDistance(predicted: readonly number[], actual: readonly number[]): number {
  if (predicted.length !== actual.length) {
    throw new Error("Seat vectors must have the same length.");
  }
  let sum = 0;
  for (let index = 0; index < predicted.length; index += 1) {
    const delta = predicted[index] - actual[index];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

/** Sum of absolute seat errors. Each seat moved from one list to another is counted twice. */
export function sumAbsoluteError(predicted: readonly number[], actual: readonly number[]): number {
  if (predicted.length !== actual.length) {
    throw new Error("Seat vectors must have the same length.");
  }
  let sum = 0;
  for (let index = 0; index < predicted.length; index += 1) {
    sum += Math.abs(predicted[index] - actual[index]);
  }
  return sum;
}

/** Seats sitting on the wrong list. Half the absolute error when both vectors sum to 120. */
export function misplacedSeats(absolute: number): number {
  return absolute / 2;
}

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function cleanThresholdBonus(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    throw new Error("משקל הבונוס צריך להיות בין 0 ל-10.");
  }
  return Math.round(value * 100) / 100;
}

/** A guess of 4 or more says the list clears the threshold. 0–3 says it does not. */
export function predictedPasses(seats: number): boolean {
  return seats >= MIN_NONZERO_PREDICTION;
}

/** Official allocations do not hand out 1–3 seats. Any positive result passed. */
export function actualPasses(seats: number): boolean {
  return seats > 0;
}

export function scoreGuess(partyIds: string[], predicted: SeatMap, actual: SeatMap, thresholdBonus = DEFAULT_THRESHOLD_BONUS) {
  const vectors = alignVectors(partyIds, predicted, actual);
  const absolute = sumAbsoluteError(vectors.predicted, vectors.actual);
  const euclidean = euclideanDistance(vectors.predicted, vectors.actual);
  let thresholdCorrect = 0;
  const diffs: PartyDiff[] = partyIds.map((partyId, index) => {
    const guessed = vectors.predicted[index];
    const result = vectors.actual[index];
    const passedCall = predictedPasses(guessed) === actualPasses(result);
    if (passedCall) thresholdCorrect += 1;
    return { partyId, predicted: guessed, actual: result, diff: guessed - result, passedCall };
  });
  const weight = Number.isFinite(thresholdBonus) ? Math.max(0, thresholdBonus) : 0;
  const score = Math.round((absolute - weight * thresholdCorrect) * 10000) / 10000;
  return {
    absolute,
    euclidean,
    misplaced: misplacedSeats(absolute),
    score,
    thresholdCorrect,
    diffs,
  };
}

function samePlace(a: { score: number; euclidean: number }, b: { score: number; euclidean: number }): boolean {
  return roundScore(a.score) === roundScore(b.score) && roundScore(a.euclidean) === roundScore(b.euclidean);
}

export function buildStandings(
  partyIds: string[],
  actual: SeatMap,
  participants: { id: string; alias: string; predicted: SeatMap }[],
  thresholdBonus = DEFAULT_THRESHOLD_BONUS,
): InternalStanding[] {
  const scored = participants.map((participant) => {
    const guess = scoreGuess(partyIds, participant.predicted, actual, thresholdBonus);
    return {
      participantId: participant.id,
      alias: participant.alias,
      ...guess,
    };
  });
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.euclidean - b.euclidean ||
      a.alias.localeCompare(b.alias, "he") ||
      a.participantId.localeCompare(b.participantId),
  );
  let rank = 1;
  return scored.map((row, index) => {
    if (index > 0 && !samePlace(row, scored[index - 1])) rank = index + 1;
    return { ...row, rank };
  });
}

/** Public leaderboard row. Seat vectors stay on the server. */
export function toPublicStandings(rows: InternalStanding[], youId?: string): PublicStanding[] {
  return rows.map((row) => ({
    rank: row.rank,
    alias: row.alias,
    absolute: row.absolute,
    misplaced: row.misplaced,
    euclidean: roundScore(row.euclidean),
    score: roundScore(row.score),
    thresholdCorrect: row.thresholdCorrect,
    isYou: row.participantId === youId,
  }));
}
