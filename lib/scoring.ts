export type SeatMap = Record<string, number>;

export type PartyDiff = {
  partyId: string;
  predicted: number;
  actual: number;
  diff: number;
};

export type InternalStanding = {
  participantId: string;
  alias: string;
  euclidean: number;
  absolute: number;
  rank: number;
  absoluteRank: number;
  diffs: PartyDiff[];
};

export type PublicStanding = {
  rank: number;
  absoluteRank: number;
  alias: string;
  euclidean: number;
  absolute: number;
  isYou: boolean;
};

export function alignVectors(partyIds: string[], predicted: SeatMap, actual: SeatMap) {
  return {
    predicted: partyIds.map((id) => predicted[id] ?? 0),
    actual: partyIds.map((id) => actual[id] ?? 0),
  };
}

/** Root of summed squared seat errors. Lower is better. */
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

/** Sum of absolute seat errors. Lower is better. */
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

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function ranksFor(rows: { id: string; score: number }[]): Map<string, number> {
  const ordered = [...rows].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  const ranks = new Map<string, number>();
  let previous: number | null = null;
  let rank = 0;
  ordered.forEach((row, index) => {
    if (previous === null || row.score !== previous) {
      rank = index + 1;
      previous = row.score;
    }
    ranks.set(row.id, rank);
  });
  return ranks;
}

export function buildStandings(
  partyIds: string[],
  actual: SeatMap,
  participants: { id: string; alias: string; predicted: SeatMap }[],
): InternalStanding[] {
  const scored = participants.map((participant) => {
    const vectors = alignVectors(partyIds, participant.predicted, actual);
    return {
      participantId: participant.id,
      alias: participant.alias,
      euclidean: euclideanDistance(vectors.predicted, vectors.actual),
      absolute: sumAbsoluteError(vectors.predicted, vectors.actual),
      diffs: partyIds.map((partyId, index) => ({
        partyId,
        predicted: vectors.predicted[index],
        actual: vectors.actual[index],
        diff: vectors.predicted[index] - vectors.actual[index],
      })),
    };
  });
  const euclideanRanks = ranksFor(scored.map((row) => ({ id: row.participantId, score: row.euclidean })));
  const absoluteRanks = ranksFor(scored.map((row) => ({ id: row.participantId, score: row.absolute })));
  return scored
    .map((row) => ({
      ...row,
      rank: euclideanRanks.get(row.participantId) ?? 0,
      absoluteRank: absoluteRanks.get(row.participantId) ?? 0,
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.absolute - b.absolute ||
        a.alias.localeCompare(b.alias, "he"),
    );
}

/** Public leaderboard row. Seat vectors stay on the server. */
export function toPublicStandings(rows: InternalStanding[], youId?: string): PublicStanding[] {
  return rows.map((row) => ({
    rank: row.rank,
    absoluteRank: row.absoluteRank,
    alias: row.alias,
    euclidean: roundScore(row.euclidean),
    absolute: row.absolute,
    isYou: row.participantId === youId,
  }));
}
