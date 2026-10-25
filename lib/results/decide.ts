import { KNESSET_SEATS } from "../seats";
import { allocateBaderOfer, type IgnoredAgreement } from "./bader-ofer";
import type { ParsedList, ParsedResults } from "./parse-cec";

export type PartyRef = {
  id: string;
  name: string;
  ballot: string;
  matchKeys: string[];
};

export type DecidedRow = {
  partyId: string | null;
  sourceName: string;
  sourceBallot: string;
  votes: number | null;
  officialSeats: number | null;
  seats: number;
  passedThreshold: boolean;
  mapped: boolean;
};

export type Decision = {
  method: "bader-ofer" | "official-mandates" | "incomplete";
  rows: DecidedRow[];
  warnings: string[];
  scoreable: boolean;
  ignoredAgreements: IgnoredAgreement[];
};

export function normalizeMatchKey(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function matchParty(list: Pick<ParsedList, "name" | "ballot">, parties: PartyRef[]): PartyRef | null {
  const ballot = normalizeMatchKey(list.ballot);
  if (ballot) {
    const byBallot = parties.find(
      (party) =>
        normalizeMatchKey(party.ballot) === ballot ||
        party.matchKeys.some((key) => normalizeMatchKey(key) === ballot),
    );
    if (byBallot) return byBallot;
  }
  const name = normalizeMatchKey(list.name);
  if (!name) return null;
  return (
    parties.find(
      (party) =>
        normalizeMatchKey(party.name) === name ||
        party.matchKeys.some((key) => normalizeMatchKey(key) === name),
    ) ?? null
  );
}

type Bucket = {
  key: string;
  partyId: string | null;
  name: string;
  ballot: string;
  votes: number | null;
  officialSeats: number | null;
};

export function decideSeats(input: {
  parsed: Pick<ParsedResults, "lists" | "validVotes">;
  parties: PartyRef[];
  agreements: { a: string; b: string }[];
  preferComputed: boolean;
}): Decision {
  const buckets = new Map<string, Bucket>();
  input.parsed.lists.forEach((list, index) => {
    const party = matchParty(list, input.parties);
    const key = party ? `party:${party.id}` : `unmapped:${index}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        key,
        partyId: party?.id ?? null,
        name: party?.name ?? list.name,
        ballot: party?.ballot || list.ballot,
        votes: list.votes,
        officialSeats: list.officialSeats,
      });
      return;
    }
    existing.votes = sumNullable(existing.votes, list.votes);
    existing.officialSeats = sumNullable(existing.officialSeats, list.officialSeats);
  });

  const bucketList = [...buckets.values()];
  const votesComplete = bucketList.length > 0 && bucketList.every((bucket) => bucket.votes != null);
  const officialSum = bucketList.reduce((sum, bucket) => sum + (bucket.officialSeats ?? 0), 0);
  const officialComplete =
    bucketList.length > 0 && bucketList.every((bucket) => bucket.officialSeats != null) && officialSum === KNESSET_SEATS;
  const validVotes =
    input.parsed.validVotes ??
    (votesComplete ? bucketList.reduce((sum, bucket) => sum + (bucket.votes ?? 0), 0) : null);

  let computed: ReturnType<typeof allocateBaderOfer> | null = null;
  if (votesComplete && validVotes != null) {
    computed = allocateBaderOfer({
      lists: bucketList.map((bucket) => ({ id: bucket.key, votes: bucket.votes ?? 0 })),
      agreements: input.agreements
        .map((agreement) => ({ a: `party:${agreement.a}`, b: `party:${agreement.b}` }))
        .filter((agreement) => buckets.has(agreement.a) && buckets.has(agreement.b)),
      validVotes,
    });
  }

  let method: Decision["method"] = "incomplete";
  if (!input.preferComputed && officialComplete) method = "official-mandates";
  else if (computed) method = "bader-ofer";
  else if (officialComplete) method = "official-mandates";

  const warnings: string[] = [];
  const partyName = new Map(input.parties.map((party) => [party.id, party.name]));
  const ignored = computed?.ignoredAgreements ?? [];
  for (const agreement of input.agreements) {
    const reason = ignored.find(
      (item) =>
        (item.a === `party:${agreement.a}` && item.b === `party:${agreement.b}`) ||
        (item.a === `party:${agreement.b}` && item.b === `party:${agreement.a}`),
    )?.reason;
    if (!reason && computed) continue;
    if (reason === "below-threshold") {
      warnings.push(
        `הסכם עודפים בטל: ${partyName.get(agreement.a) ?? "רשימה"} ו${partyName.get(agreement.b) ?? "רשימה"} — אחד הצדדים מתחת לאחוז החסימה.`,
      );
    }
  }

  if (computed && officialComplete) {
    const differs = bucketList.some((bucket) => (computed!.seats[bucket.key] ?? 0) !== (bucket.officialSeats ?? 0));
    if (differs) {
      warnings.push(
        method === "bader-ofer"
          ? "חישוב באדר-עופר לא זהה למנדטים שבמקור. מוצג החישוב, לפי הגדרת הקבוצה."
          : "חישוב באדר-עופר לא זהה למנדטים שבמקור. מוצגים המנדטים שפרסמה ועדת הבחירות.",
      );
    }
  }

  const rows: DecidedRow[] = bucketList.map((bucket) => {
    const seats =
      method === "bader-ofer"
        ? computed?.seats[bucket.key] ?? 0
        : method === "official-mandates"
          ? bucket.officialSeats ?? 0
          : bucket.officialSeats ?? 0;
    const passed =
      computed?.passed[bucket.key] ??
      (bucket.officialSeats != null ? bucket.officialSeats > 0 : false);
    return {
      partyId: bucket.partyId,
      sourceName: bucket.name,
      sourceBallot: bucket.ballot,
      votes: bucket.votes,
      officialSeats: bucket.officialSeats,
      seats,
      passedThreshold: passed,
      mapped: bucket.partyId != null,
    };
  });

  const total = rows.reduce((sum, row) => sum + row.seats, 0);
  return {
    method: method === "incomplete" ? "incomplete" : method,
    rows,
    warnings,
    scoreable: total === KNESSET_SEATS,
    ignoredAgreements: ignored,
  };
}

function sumNullable(left: number | null, right: number | null): number | null {
  if (left == null || right == null) return null;
  return left + right;
}
