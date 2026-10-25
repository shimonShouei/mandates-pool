import { predictedPasses } from "./scoring";

/** Aggregates stay hidden below this many complete bets, so one guess cannot be read back. */
export const DEFAULT_CROWD_MIN = 5;
export const MAJORITY_SEATS = 61;

export type HistogramBin = { from: number; to: number; count: number };

export type PartyAggregate = {
  partyId: string;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  passPercent: number;
  histogram: HistogramBin[];
  actual: number | null;
};

export type BlocAggregate = {
  blocId: string;
  name: string;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  majorityPercent: number;
  actual: number | null;
  actualMajority: boolean | null;
};

export type CrowdReport = {
  visible: boolean;
  reason: "lock" | "min" | null;
  sampleSize: number | null;
  minBets: number;
  parties: PartyAggregate[];
  blocs: BlocAggregate[];
};

export type CrowdPartyView = PartyAggregate & {
  name: string;
  ballot: string;
  color: string;
};

export type CrowdView = {
  visible: boolean;
  reason: "lock" | "min" | null;
  sampleSize: number | null;
  minBets: number;
  parties: CrowdPartyView[];
  blocs: BlocAggregate[];
};

const BIN_EDGES = [0, 1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 50, 60, 80, 121];

export function cleanCrowdMin(value: number): number {
  if (!Number.isInteger(value) || value < 2 || value > 500) {
    throw new Error("סף הניחושים צריך להיות מספר שלם בין 2 ל-500.");
  }
  return value;
}

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function medianOf(sorted: number[]): number {
  const count = sorted.length;
  if (count === 0) return 0;
  const mid = Math.floor(count / 2);
  if (count % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median, and the medians of the lower and upper halves (the middle value is left out when the count is odd). */
export function quartiles(values: number[]): { q1: number; median: number; q3: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mid = Math.floor(count / 2);
  const lower = sorted.slice(0, mid);
  const upper = sorted.slice(count % 2 === 0 ? mid : mid + 1);
  return {
    q1: roundTenth(medianOf(lower.length > 0 ? lower : sorted)),
    median: roundTenth(medianOf(sorted)),
    q3: roundTenth(medianOf(upper.length > 0 ? upper : sorted)),
  };
}

export function histogram(values: number[]): HistogramBin[] {
  const bins: HistogramBin[] = [];
  for (let index = 0; index < BIN_EDGES.length - 1; index += 1) {
    const from = BIN_EDGES[index];
    const to = BIN_EDGES[index + 1] - 1;
    bins.push({
      from,
      to,
      count: values.filter((value) => value >= from && value <= to).length,
    });
  }
  let last = bins.length - 1;
  while (last > 0 && bins[last].count === 0) last -= 1;
  return bins.slice(0, last + 1);
}

function hidden(reason: "lock" | "min", sampleSize: number | null, minBets: number): CrowdReport {
  return { visible: false, reason, sampleSize, minBets, parties: [], blocs: [] };
}

function summarize(values: number[], actual: number | null, pass: (value: number) => boolean) {
  const stats = quartiles(values);
  const mean = roundTenth(values.reduce((sum, value) => sum + value, 0) / values.length);
  const hits = values.filter(pass).length;
  return {
    mean,
    median: stats.median,
    q1: stats.q1,
    q3: stats.q3,
    percent: Math.round((100 * hits) / values.length),
    actual,
  };
}

export function aggregateCrowd(input: {
  partyIds: string[];
  vectors: number[][];
  actual: Record<string, number> | null;
  blocs: { id: string; name: string; partyIds: string[] }[];
  minBets: number;
  hiddenBecauseUnlocked?: boolean;
}): CrowdReport {
  const minBets = input.minBets;
  if (input.hiddenBecauseUnlocked) return hidden("lock", null, minBets);
  const sampleSize = input.vectors.length;
  if (sampleSize < minBets) return hidden("min", sampleSize, minBets);

  const columns = input.partyIds.map((_, index) => input.vectors.map((vector) => vector[index] ?? 0));
  const parties: PartyAggregate[] = input.partyIds.map((partyId, index) => {
    const values = columns[index];
    const summary = summarize(values, input.actual ? (input.actual[partyId] ?? 0) : null, predictedPasses);
    return {
      partyId,
      mean: summary.mean,
      median: summary.median,
      q1: summary.q1,
      q3: summary.q3,
      passPercent: summary.percent,
      histogram: histogram(values),
      actual: summary.actual,
    };
  });

  const blocs: BlocAggregate[] = input.blocs.map((bloc) => {
    const indexes = bloc.partyIds.map((partyId) => input.partyIds.indexOf(partyId)).filter((index) => index >= 0);
    const totals = input.vectors.map((vector) => indexes.reduce((sum, index) => sum + (vector[index] ?? 0), 0));
    const actual = input.actual
      ? bloc.partyIds.reduce((sum, partyId) => sum + (input.actual?.[partyId] ?? 0), 0)
      : null;
    const summary = summarize(totals, actual, (value) => value >= MAJORITY_SEATS);
    return {
      blocId: bloc.id,
      name: bloc.name,
      mean: summary.mean,
      median: summary.median,
      q1: summary.q1,
      q3: summary.q3,
      majorityPercent: summary.percent,
      actual,
      actualMajority: actual == null ? null : actual >= MAJORITY_SEATS,
    };
  });

  return { visible: true, reason: null, sampleSize, minBets, parties, blocs };
}

export function presentCrowd(
  report: CrowdReport,
  parties: { id: string; name: string; ballot: string; color: string }[],
): CrowdView {
  if (!report.visible) {
    return {
      visible: false,
      reason: report.reason,
      sampleSize: report.sampleSize,
      minBets: report.minBets,
      parties: [],
      blocs: [],
    };
  }
  const byId = new Map(parties.map((party) => [party.id, party]));
  return {
    visible: true,
    reason: null,
    sampleSize: report.sampleSize,
    minBets: report.minBets,
    parties: report.parties.flatMap((row) => {
      const party = byId.get(row.partyId);
      if (!party) return [];
      return [{ ...row, name: party.name, ballot: party.ballot, color: party.color }];
    }),
    blocs: report.blocs,
  };
}
