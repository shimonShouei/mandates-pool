import { parseCecPayload, type ParsedResults } from "./parse-cec";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export function candidateResultUrls(knessetNumber: number, sourceUrl?: string | null): string[] {
  const urls = [
    sourceUrl?.trim() || "",
    `https://votes${knessetNumber}.bechirot.gov.il/nationalresults`,
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
    if (Date.now() - started > 7000) break;
    attempted.push(url);
    const national = /\/nationalresults\/?$/.test(url);
    try {
      const response = await fetchImpl(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
        headers: {
          accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "he-IL,he;q=0.9,en;q=0.5",
          "user-agent": BROWSER_UA,
        },
      });
      const wafHeader = response.headers.get("x-amzn-waf-action");
      if (response.status === 202 && wafHeader) {
        sawWaf = true;
        if (national) nationalWaf = true;
        continue;
      }
      if (response.status === 404) {
        sawNotFound = true;
        if (national) nationalNotFound = true;
        continue;
      }
      if (!response.ok) continue;
      const body = await response.text();
      if (body.length > 3_000_000) continue;
      if (isWafBody(body)) {
        sawWaf = true;
        if (national) nationalWaf = true;
        continue;
      }
      const parsed = parseCecPayload(body);
      if (parsed && parsed.lists.length > 0) return { ok: true, parsed, url };
    } catch {
      /* try the next host */
    }
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

function isWafBody(body: string): boolean {
  return /awsWaf|x-amzn-waf|challenge-container|gokuProps/i.test(body) && !/<table\b/i.test(body);
}
