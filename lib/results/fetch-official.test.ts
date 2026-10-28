import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchOfficialResults } from "./fetch-official";

function response(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe("official fetch", () => {
  it("parses a national results page", async () => {
    const html = readFileSync(path.join(process.cwd(), "fixtures/votes25-national.html"), "utf8");
    const outcome = await fetchOfficialResults({
      knessetNumber: 25,
      sourceUrl: "https://example.test/nationalresults",
      fetchImpl: async () => response(html),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.parsed.lists.find((list) => list.ballot === "מחל")?.votes).toBe(1115336);
  });

  it("explains an AWS WAF challenge instead of throwing", async () => {
    const outcome = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "https://votes26.bechirot.gov.il/nationalresults",
      fetchImpl: async () => response("<html>awsWaf challenge</html>", 202, { "x-amzn-waf-action": "challenge" }),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("WAF");
  });

  it("treats a missing national page as unpublished even if another host challenges", async () => {
    const outcome = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "",
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/nationalresults")) return response("missing", 404);
        return response("<html>awsWaf challenge</html>", 202, { "x-amzn-waf-action": "challenge" });
      },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("אין דף תוצאות");
  });

  it("reads the official page through the HTML reader when the host answers with a WAF challenge", async () => {
    const html = readFileSync(path.join(process.cwd(), "fixtures/votes26-national.html"), "utf8");
    const outcome = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "",
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("r.jina.ai")) {
          if (!url.includes("lang=he")) return response("missing query", 404);
          return response(html);
        }
        return response("<html>awsWaf challenge</html>", 202, { "x-amzn-waf-action": "challenge" });
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.url).toBe("https://votes26.bechirot.gov.il/nationalresults");
    expect(outcome.parsed.lists.find((list) => list.ballot === "מחל")?.votes).toBe(917371);
    expect(outcome.parsed.status).toBe("provisional");
  });

  it("sends reader headers, retries a timeout once, and returns JSON-level failure", async () => {
    const html = readFileSync(path.join(process.cwd(), "fixtures/votes26-national.html"), "utf8");
    const seen: { timeout: string | null; format: string | null }[] = [];
    let readerCalls = 0;
    const recovered = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "https://votes26.bechirot.gov.il/nationalresults",
      readerTimeoutMs: 45_000,
      readerRetries: 1,
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (!url.includes("r.jina.ai")) {
          return response("<html>awsWaf challenge</html>", 202, { "x-amzn-waf-action": "challenge" });
        }
        readerCalls += 1;
        const headers = new Headers(init?.headers);
        seen.push({ timeout: headers.get("x-timeout"), format: headers.get("x-return-format") });
        if (readerCalls === 1) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
        return response(html);
      },
    });
    expect(readerCalls).toBe(2);
    expect(seen[0]).toEqual({ timeout: "42", format: "html" });
    expect(recovered.ok).toBe(true);

    const timedOut = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "https://votes26.bechirot.gov.il/nationalresults",
      readerTimeoutMs: 45_000,
      readerRetries: 1,
      fetchImpl: async (input) => {
        const url = String(input);
        if (!url.includes("r.jina.ai")) {
          return response("<html>awsWaf challenge</html>", 202, { "x-amzn-waf-action": "challenge" });
        }
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      },
    });
    expect(timedOut.ok).toBe(false);
    if (!timedOut.ok) expect(timedOut.error).toContain("עבר הזמן");
  });

  it("explains a missing results site", async () => {
    const outcome = await fetchOfficialResults({
      knessetNumber: 26,
      sourceUrl: "https://votes26.bechirot.gov.il/nationalresults",
      fetchImpl: async () => response("missing", 404),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("אין דף תוצאות");
  });
});
