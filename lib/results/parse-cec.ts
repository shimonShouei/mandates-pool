import { jerusalemLocalToIso } from "../time";

export type ParsedList = {
  name: string;
  ballot: string;
  votes: number | null;
  officialSeats: number | null;
  votePercent: number | null;
};

export type ParsedResults = {
  status: "provisional" | "final";
  countedPercent: number | null;
  turnoutPercent: number | null;
  eligibleVoters: number | null;
  ballotsCast: number | null;
  validVotes: number | null;
  invalidVotes: number | null;
  lists: ParsedList[];
  format: string;
  /** Official "results as of" instant, when the page prints one. */
  reportedAt?: string | null;
};

export function parseCecPayload(body: string): ParsedResults | null {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = parseCecJson(JSON.parse(trimmed));
      if (parsed) return parsed;
    } catch {
      return null;
    }
  }
  if (/<table\b/i.test(body) || /אחוז הקולות שנספרו/.test(body)) {
    return parseCecHtml(body);
  }
  return null;
}

export function parseCecHtml(html: string): ParsedResults | null {
  const parsedTables = extractTables(html);
  let summary: Partial<ParsedResults> = {};
  let lists: ParsedList[] = [];

  for (const table of parsedTables) {
    if (table.length < 2) continue;
    const headers = table[0].map(normalizeHeader);
    const values = table[1];
    if (isSummaryTable(headers)) {
      summary = { ...summary, ...readSummary(headers, values) };
    }
    if (isPartyTable(headers) && lists.length === 0) {
      lists = readParties(headers, table.slice(1));
    }
  }

  if (lists.length === 0) return null;

  const cards = readInfoCards(html);
  const plain = stripTags(html);
  let status: ParsedResults["status"] = "provisional";
  // "התוצאות הסופיות … יפורסמו" is the legal deadline, not a final count.
  // A final page says "תוצאות סופיות" with no ה before סופיות.
  if (/תוצאות\s+סופיות/.test(plain)) status = "final";
  else if (/ארעי/.test(plain)) status = "provisional";

  let countedPercent = summary.countedPercent ?? cards.countedPercent ?? coverageFromText(plain);
  if (countedPercent == null && status === "final") countedPercent = 100;

  const eligibleVoters = summary.eligibleVoters ?? cards.eligibleVoters ?? null;
  const ballotsCast = summary.ballotsCast ?? cards.ballotsCast ?? null;
  let turnoutPercent = summary.turnoutPercent ?? cards.turnoutPercent ?? null;
  if (turnoutPercent == null && status === "final" && eligibleVoters && ballotsCast && eligibleVoters > 0) {
    turnoutPercent = (ballotsCast / eligibleVoters) * 100;
  }

  return {
    status,
    countedPercent,
    turnoutPercent,
    eligibleVoters,
    ballotsCast,
    validVotes: summary.validVotes ?? cards.validVotes ?? null,
    invalidVotes: summary.invalidVotes ?? cards.invalidVotes ?? null,
    lists,
    format: "cec-html-table",
    reportedAt: reportedAtFromText(plain),
  };
}

export function parseCecJson(data: unknown): ParsedResults | null {
  const listsRaw = findListArray(data);
  if (!listsRaw) return null;
  const lists: ParsedList[] = [];
  for (const item of listsRaw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = firstString(record, ["name", "listName", "party", "partyName", "shem", "שם"]);
    const ballot = firstString(record, ["letters", "letter", "ballot", "symbol", "ot", "אותיות", "אות"]);
    const votes = firstNumber(record, ["votes", "validVotes", "voteCount", "kosher", "קולות"]);
    const officialSeats = firstNumber(record, ["mandates", "mandate", "seats", "seatCount", "מנדטים"]);
    const votePercent = firstNumber(record, ["percent", "percentage", "votePercent", "אחוז"]);
    if (!name && !ballot) continue;
    if (votes == null && officialSeats == null) continue;
    lists.push({
      name: name ?? ballot ?? "",
      ballot: ballot ?? "",
      votes: votes == null ? null : Math.round(votes),
      officialSeats: officialSeats == null ? null : Math.round(officialSeats),
      votePercent,
    });
  }
  if (lists.length === 0) return null;

  const root = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const status: ParsedResults["status"] =
    root.final === true || root.status === "final" || root.status === "סופי" ? "final" : "provisional";
  const counted = firstNumber(root, ["countedPercent", "coverage", "progress", "counted"]);
  const turnout = firstNumber(root, ["turnoutPercent", "turnout"]);

  return {
    status,
    countedPercent: counted ?? (status === "final" ? 100 : null),
    turnoutPercent: turnout,
    eligibleVoters: integerOrNull(firstNumber(root, ["eligible", "eligibleVoters", "voters"])),
    ballotsCast: integerOrNull(firstNumber(root, ["ballots", "ballotsCast", "votesCast"])),
    validVotes: integerOrNull(firstNumber(root, ["valid", "validVotes"])),
    invalidVotes: integerOrNull(firstNumber(root, ["invalid", "invalidVotes"])),
    lists,
    format: "cec-json",
    reportedAt: null,
  };
}

function readSummary(headers: string[], values: string[]): Partial<ParsedResults> {
  const out: Partial<ParsedResults> = {};
  headers.forEach((header, index) => {
    const value = parseNumber(values[index]);
    if (value == null) return;
    if (header.includes("פסול")) out.invalidVotes = Math.round(value);
    else if (header.includes("כשר")) out.validVotes = Math.round(value);
    else if (header.includes("הצבעה")) out.turnoutPercent = value;
    else if (header.includes("בעלי זכות")) out.eligibleVoters = Math.round(value);
    else if (
      (header.includes("אחוז") && header.includes("שנספרו")) ||
      header.includes("אחוז כיסוי") ||
      header.includes("אחוז הקלפיות") ||
      header.includes("שיעור ספירה")
    ) {
      out.countedPercent = value;
    } else if (header.includes("הוזנו") || header.includes("קלפי")) out.ballotsCast = Math.round(value);
  });
  return out;
}

function readParties(headers: string[], rows: string[][]): ParsedList[] {
  const nameIdx = headers.findIndex((header) => header.includes("שם"));
  const ballotIdx = headers.findIndex((header) => header.includes("אות"));
  const seatsIdx = headers.findIndex((header) => header.includes("מנדט") || header.includes("מושב"));
  const percentIdx = headers.findIndex((header) => header.includes("אחוז"));
  const votesIdx = headers.findIndex((header) => header.includes("קולות") && !header.includes("אחוז"));
  const lists: ParsedList[] = [];
  for (const row of rows) {
    const name = nameIdx >= 0 ? row[nameIdx]?.trim() ?? "" : "";
    const ballot = ballotIdx >= 0 ? row[ballotIdx]?.trim() ?? "" : "";
    if (!name && !ballot) continue;
    const votes = votesIdx >= 0 ? parseNumber(row[votesIdx]) : null;
    const officialSeats = seatsIdx >= 0 ? parseNumber(row[seatsIdx]) : null;
    const votePercent = percentIdx >= 0 ? parseNumber(row[percentIdx]) : null;
    if (votes == null && officialSeats == null) continue;
    lists.push({
      name,
      ballot,
      votes: votes == null ? null : Math.round(votes),
      officialSeats: officialSeats == null ? null : Math.round(officialSeats),
      votePercent,
    });
  }
  return lists;
}

function isSummaryTable(headers: string[]): boolean {
  const joined = headers.join(" ");
  return joined.includes("בעלי זכות") || joined.includes("קולות שהוזנו") || joined.includes("שיעור ההצבעה");
}

function isPartyTable(headers: string[]): boolean {
  const joined = headers.join(" ");
  return joined.includes("שם") && (joined.includes("קולות") || joined.includes("מנדט") || joined.includes("אות"));
}

/** 2026 national page: label div, then a bold div with the figure. Not a summary table. */
function readInfoCards(html: string): Partial<ParsedResults> {
  const out: Partial<ParsedResults> = {};
  const re =
    /<div[^>]*>\s*(מספר בעלי זכות בחירה|קולות עד עתה|קולות שהוזנו|קולות כשרים עד עתה|קולות פסולים עד עתה|שיעור ההצבעה|אחוז הקולות שנספרו|אחוז כיסוי)\s*<\/div>\s*<div[^>]*>\s*([\d][\d,.]*)\s*%?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const label = match[1];
    const value = parseNumber(match[2]);
    if (value == null) continue;
    if (label.includes("בעלי זכות")) out.eligibleVoters = Math.round(value);
    else if (label.includes("פסול")) out.invalidVotes = Math.round(value);
    else if (label.includes("כשר")) out.validVotes = Math.round(value);
    else if (label.includes("הצבעה") || label.includes("נספרו") || label.includes("כיסוי")) {
      if (label.includes("הצבעה")) out.turnoutPercent = value;
      else out.countedPercent = value;
    } else if (label.includes("קולות")) out.ballotsCast = Math.round(value);
  }
  return out;
}

function reportedAtFromText(text: string): string | null {
  const match = text.match(/תוצאות נכון ל-\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return jerusalemLocalToIso(`${year}-${month}-${day}T${hour}:${minute}`);
}

function coverageFromText(text: string): number | null {
  const match = text.match(/אחוז הקולות שנספרו[^0-9]{0,24}([0-9]+(?:[.,][0-9]+)?)\s*%/);
  if (!match) return null;
  return parseNumber(match[1]);
}

function extractTables(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html))) {
    const rows: string[][] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(tableMatch[1]))) {
      const cells: string[] = [];
      const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1]))) cells.push(decodeCell(cellMatch[1]));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

function decodeCell(value: string): string {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeHeader(value: string): string {
  return value.replace(/["'׳״`]/g, "").replace(/\s+/g, " ").trim();
}

function parseNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function findListArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  for (const key of ["lists", "results", "parties", "data", "rows"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = parseNumber(value);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

function integerOrNull(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}
