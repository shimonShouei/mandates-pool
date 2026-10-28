import { parseCecPayload, type ParsedResults } from "./parse-cec";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const DIRECT_BUDGET_MS = 2500;
const ATTEMPT_TIMEOUT_MS = 2000;
const READER_TIMEOUT_MS = 6000;

export function officialNationalUrl(knessetNumber: number): string {
  return `https://votes${knessetNumber}.bechirot.gov.il/nationalresults`;
}

/** Empty string disables the reader. Unset uses the public HTML reader. */
export function readerResultUrl(knessetNumber: number, base: string | null | undefined = process.env.RESULTS_READER_URL): string | null {
  if (base === "") return null;
  const prefix = (base == null ? "https://r.jina.ai/" : base).trim();
  if (!prefix) return null;
  return `${prefix.replace(/\/$/, "")}/${officialNationalUrl(knessetNumber)}`;
}

export function candidateResultUrls(knessetNumber: number, sourceUrl?: string | null): string[] {
  const urls = [
    sourceUrl?.trim() || "",
    officialNationalUrl(knessetNumber),
    `https://votes${knessetNumber}.bechirot.gov.il/`,
    `https://cdn-votes${knessetNumber}.bechirot.gov.il/nationalresults`,
  ].filter(Boolean);
  return [...new Set(urls)];
}

export type FetchOutcome =
  | { ok: true; parsed: ParsedResults; url: string }
  | { ok: false; error: string; attempted: string[] };

export async function fetchOfficialResults(options: {
  knessetNumber: number;
  sourceUrl?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<FetchOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const urls = candidateResultUrls(options.knessetNumber, options.sourceUrl ?? process.env.RESULTS_SOURCE_URL);
  const attempted: string[] = [];
  let sawWaf = false;
  let sawNotFound = false;
  let nationalWaf = false;
  let nationalNotFound = false;

  const started = Date.now();
  for (const url of urls) {
    if (Date.now() - started > DIRECT_BUDGET_MS) break;
    attempted.push(url);
    const national = /\/nationalresults\/?(?:\?|$)/.test(url);
    const outcome = await readResults(fetchImpl, url, ATTEMPT_TIMEOUT_MS, false);
    if (outcome.kind === "parsed") return { ok: true, parsed: outcome.parsed, url };
    if (outcome.kind === "waf") {
      sawWaf = true;
      if (national) nationalWaf = true;
      if (national) break;
      continue;
    }
    if (outcome.kind === "missing") {
      sawNotFound = true;
      if (national) nationalNotFound = true;
    }
  }

  const reader = readerResultUrl(options.knessetNumber);
  if (reader) {
    attempted.push(reader);
    const viaReader = await readResults(fetchImpl, reader, READER_TIMEOUT_MS, true);
    if (viaReader.kind === "parsed") {
      return { ok: true, parsed: viaReader.parsed, url: officialNationalUrl(options.knessetNumber) };
    }
    if (viaReader.kind === "waf") sawWaf = true;
    if (viaReader.kind === "missing") sawNotFound = true;
  }

  if (nationalWaf || (sawWaf && !nationalNotFound)) {
    return {
      ok: false,
      attempted,
      error:
        "ועדת הבחירות החזירה אתגר אבטחה (WAF) במקום דף תוצאות. אפשר להעלות את קובץ ה-HTML מהדפדפן, או להזין מנדטים ידנית.",
    };
  }
  if (sawNotFound) {
    return {
      ok: false,
      attempted,
      error: "עדיין אין דף תוצאות פומבי בכתובת של ועדת הבחירות לכנסת הזו.",
    };
  }
  return {
    ok: false,
    attempted,
    error: "לא הצלחנו לקרוא טבלת תוצאות מוועדת הבחירות.",
  };
}

type ReadHit =
  | { kind: "parsed"; parsed: ParsedResults }
  | { kind: "waf" }
  | { kind: "missing" }
  | { kind: "other" };

async function readResults(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  reader: boolean,
): Promise<ReadHit> {
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "he-IL,he;q=0.9,en;q=0.5",
        "user-agent": BROWSER_UA,
        ...(reader ? { "x-return-format": "html" } : {}),
      },
    });
    const wafHeader = response.headers.get("x-amzn-waf-action");
    if (response.status === 202 && wafHeader) return { kind: "waf" };
    const body = await response.text();
    if (isWafBody(body) || isGeoBlock(body)) return { kind: "waf" };
    if (response.status === 404) return { kind: "missing" };
    if (!response.ok) return { kind: "other" };
    if (body.length > 3_000_000) return { kind: "other" };
    const parsed = parseCecPayload(body);
    if (parsed && parsed.lists.length > 0) return { kind: "parsed", parsed };
    return { kind: "other" };
  } catch {
    return { kind: "other" };
  }
}

function isWafBody(body: string): boolean {
  return /awsWaf|x-amzn-waf|challenge-container|gokuProps/i.test(body) && !/<table\b/i.test(body);
}

function isGeoBlock(body: string): boolean {
  return /העמוד שחיפשת לא נמצא/.test(body) || /maintenance\.gov\.il/.test(body);
}
