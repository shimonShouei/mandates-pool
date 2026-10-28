/**
 * 26th Knesset, 27 Oct 2026. The Central Elections Committee approved 38
 * lists on 27 Sep 2026. Blue and White (כן) and Achi (צבי) withdrew, so 36
 * lists are on the ballot. Ra'am (עם) and the Joint List (ודם) were cleared
 * by the Supreme Court on 2 Oct 2026.
 *
 * Bets use the 13 competitive lists. The minor lists are known to the
 * results parser only: their votes count toward the threshold, they normally
 * take 0 seats, and a seat they do win is scored as a guess of 0.
 * The research record is fixtures/parties-2026.json.
 */
import catalog from "../fixtures/parties-2026.json";

export type SeedParty = {
  name: string;
  ballot: string;
  color: string;
  matchKeys: string[];
};

type CatalogParty = {
  name: string;
  ballot: string;
  color: string;
  matchKeys: string[];
  fullName?: string;
};

/** Keep the bet slip in this order. The homepage chips use the first rows. */
const BET_BALLOTS = ["מחל", "רק", "דרך", "אמת", "שס", "ג", "ב", "ל", "ט", "עם", "ודם", "די", "ך"] as const;

function toSeed(row: CatalogParty): SeedParty {
  const matchKeys = [...row.matchKeys];
  if (row.fullName && !matchKeys.includes(row.fullName)) matchKeys.push(row.fullName);
  return { name: row.name, ballot: row.ballot, color: row.color, matchKeys };
}

function byBallot(ballot: string): CatalogParty {
  const row = (catalog.parties as CatalogParty[]).find((party) => party.ballot === ballot);
  if (!row) throw new Error(`2026 catalog is missing ballot ${ballot}`);
  return row;
}

export const SEED_PARTIES: SeedParty[] = BET_BALLOTS.map((ballot) => toSeed(byBallot(ballot)));

export const MINOR_LISTS: SeedParty[] = (catalog.minorLists as CatalogParty[]).map(toSeed);

export const WITHDRAWN_LISTS: { ballot: string; name: string }[] = catalog.notRunning.map((list) => ({
  ballot: list.ballot,
  name: list.fullName,
}));

export const SEED_SURPLUS_AGREEMENTS: { a: string; b: string }[] = catalog.surplusAgreements.map((pair) => ({
  a: pair.a,
  b: pair.b,
}));

if (SEED_PARTIES.length !== 13 || MINOR_LISTS.length !== 23 || WITHDRAWN_LISTS.length !== 2) {
  throw new Error("2026 catalog should be 13 competitive lists, 23 minor lists, and 2 withdrawals");
}
if (SEED_SURPLUS_AGREEMENTS.length !== 5) {
  throw new Error("2026 catalog should carry the 5 signed surplus agreements");
}
