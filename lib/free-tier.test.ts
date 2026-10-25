import { afterEach, describe, expect, it } from "vitest";
import { createSqliteDb } from "./db";
import { donationUrl } from "./donation";
import { getSite, updateSite } from "./game";
import { privateCacheHeaders, PUBLIC_CACHE_CONTROL, publicCacheHeaders } from "./http-cache";
import { pooledNeonUrl } from "./neon-url";

describe("free-tier helpers", () => {
  const previousDonation = process.env.DONATION_URL;
  const previousDirect = process.env.DATABASE_DIRECT;

  afterEach(() => {
    if (previousDonation == null) delete process.env.DONATION_URL;
    else process.env.DONATION_URL = previousDonation;
    if (previousDirect == null) delete process.env.DATABASE_DIRECT;
    else process.env.DATABASE_DIRECT = previousDirect;
  });

  it("hides a donation link unless the env var is an http(s) url", () => {
    delete process.env.DONATION_URL;
    expect(donationUrl()).toBeNull();
    process.env.DONATION_URL = "   ";
    expect(donationUrl()).toBeNull();
    process.env.DONATION_URL = "javascript:alert(1)";
    expect(donationUrl()).toBeNull();
    process.env.DONATION_URL = "not a url";
    expect(donationUrl()).toBeNull();
    process.env.DONATION_URL = "https://www.buymeacoffee.com/example";
    expect(donationUrl()).toBe("https://www.buymeacoffee.com/example");
  });

  it("rewrites a Neon host onto the pooler and leaves other databases alone", () => {
    delete process.env.DATABASE_DIRECT;
    const neon = "postgres://user:pass@ep-abc.us-east-2.aws.neon.tech/neondb?sslmode=require";
    expect(pooledNeonUrl(neon)).toBe(
      "postgres://user:pass@ep-abc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    );
    const pooled = "postgres://user:pass@ep-abc-pooler.us-east-2.aws.neon.tech/neondb";
    expect(pooledNeonUrl(pooled)).toBe(pooled);
    expect(pooledNeonUrl("postgres://user:pass@db.example.com/app")).toBe("postgres://user:pass@db.example.com/app");
    expect(pooledNeonUrl("not a url")).toBe("not a url");
    process.env.DATABASE_DIRECT = "1";
    expect(pooledNeonUrl(neon)).toBe(neon);
  });

  it("caches public boards at the edge and never caches a private bet", () => {
    expect(PUBLIC_CACHE_CONTROL).toContain("s-maxage=30");
    expect(PUBLIC_CACHE_CONTROL).toContain("stale-while-revalidate=120");
    expect(publicCacheHeaders()["cache-control"]).toBe(PUBLIC_CACHE_CONTROL);
    expect(privateCacheHeaders()["cache-control"]).toBe("private, no-store");
  });

  it("stores the threshold bonus and rejects a weight outside 0–10", async () => {
    const db = await createSqliteDb(":memory:");
    await updateSite(db, { thresholdBonus: 1.2 });
    expect((await getSite(db)).thresholdBonus).toBe(1.2);
    await updateSite(db, { thresholdBonus: 0 });
    expect((await getSite(db)).thresholdBonus).toBe(0);
    await expect(updateSite(db, { thresholdBonus: 11 })).rejects.toThrow(/10/);
  });
});
