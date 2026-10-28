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
        if (url.includes("r.jina.ai")) return response(html);
        return response("<html>awsWaf challenge</html>", 202, { "x-amzn-waf-action": "challenge" });
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.url).toBe("https://votes26.bechirot.gov.il/nationalresults");
    expect(outcome.parsed.lists.find((list) => list.ballot === "מחל")?.votes).toBe(917371);
    expect(outcome.parsed.status).toBe("provisional");
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
