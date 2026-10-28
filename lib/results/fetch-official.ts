import { parseCecPayload, type ParsedResults } from "./parse-cec";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const DIRECT_BUDGET_MS = 2500;
const ATTEMPT_TIMEOUT_MS = 2000;
/** Page views stay short. The cron route asks for the long reader budget. */
const READER_TIMEOUT_MS = 6000;
const CRON_READER_TIMEOUT_MS = 45_000;
const CRON_READER_ATTEMPTS = 2;

export function officialNationalUrl(knessetNumber: number): string {
  return `https://votes${knessetNumber}.bechirot.gov.il/nationalresults`;
}

/** Empty string disables the reader. Unset uses the public HTML reader. */
export function readerResultUrl(knessetNumber: number, base: string | null | undefined = process.env.RESULTS_READER_URL): string | null {
  if (base === "") return null;
  const prefix = (base == null ? "https://r.jina.ai/" : base).trim();
  if (!prefix) return null;
  // ?lang=he is the URL a plain HTTP reader can retrieve. The bare path
  // currently comes back as an AWS WAF challenge from outside Israel.
  return `${prefix.replace(/\/$/, "")}/${officialNationalUrl(knessetNumber)}?lang=he`;
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
  /** Per-attempt limit for the HTML reader. The cron route uses 45s. */
  readerTimeoutMs?: number;
  /** Extra tries after the first reader request. The cron route uses 1. */
  readerRetries?: number;
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
  const readerTimeoutMs = options.readerTimeoutMs ?? READER_TIMEOUT_MS;
  const readerTries = 1 + Math.max(0, options.readerRetries ?? 0);
  let sawTimeout = false;
  if (reader) {
    // Two full 45s tries would outlive the 60s function. Cap the reader so the
    // database write still fits, and skip the retry when the first try used the budget.
    const readerBudgetMs = Math.min(readerTimeoutMs * readerTries, 48_000);
    const readerDeadline = Date.now() + readerBudgetMs;
    const minRetryMs = Math.min(8_000, readerBudgetMs / 2);
    for (let attempt = 0; attempt < readerTries; attempt++) {
      const remaining = readerDeadline - Date.now();
      if (attempt > 0 && remaining < minRetryMs) break;
      const timeoutMs = Math.min(readerTimeoutMs, Math.max(1_000, remaining));
      attempted.push(reader);
      const viaReader = await readResults(fetchImpl, reader, timeoutMs, true);
      if (viaReader.kind === "parsed") {
        return { ok: true, parsed: viaReader.parsed, url: officialNationalUrl(options.knessetNumber) };
      }
      if (viaReader.kind === "timeout") sawTimeout = true;
      if (viaReader.kind === "waf") sawWaf = true;
      if (viaReader.kind === "missing") sawNotFound = true;
    }
  }

  if (sawTimeout && !sawNotFound) {
    return {
      ok: false,
      attempted,
      error: "הקריאה לדף התוצאות נקטעה כי עבר הזמן. התוצאה השמורה נשארה כמו שהיא.",
    };
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
  | { kind: "timeout" }
  | { kind: "other" };

export const cronReaderOptions = {
  readerTimeoutMs: CRON_READER_TIMEOUT_MS,
  readerRetries: CRON_READER_ATTEMPTS - 1,
} as const;

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
        ...(reader
          ? {
              "x-return-format": "html",
              "x-timeout": String(Math.max(5, Math.ceil(timeoutMs / 1000) - 3)),
            }
          : {}),
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
  } catch (error) {
    return isTimeout(error) ? { kind: "timeout" } : { kind: "other" };
  }
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "TimeoutError" || name === "AbortError" || /timeout|aborted due to timeout/i.test(message);
}

function isWafBody(body: string): boolean {
  return /awsWaf|x-amzn-waf|challenge-container|gokuProps/i.test(body) && !/<table\b/i.test(body);
}

function isGeoBlock(body: string): boolean {
  return /העמוד שחיפשת לא נמצא/.test(body) || /maintenance\.gov\.il/.test(body);
}
