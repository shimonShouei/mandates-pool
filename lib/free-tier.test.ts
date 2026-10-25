import { afterEach, describe, expect, it } from "vitest";
import { createSqliteDb } from "./db";
import { getSite, updateSite } from "./game";
import { privateCacheHeaders, PUBLIC_CACHE_CONTROL, publicCacheHeaders } from "./http-cache";
import { directDatabaseUrl, migrationDatabaseUrl, migrationDriver, pooledNeonUrl, runtimeDatabaseUrl } from "./neon-url";

describe("free-tier helpers", () => {
  const envKeys = [
    "DATABASE_DIRECT",
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
  ] as const;
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of envKeys) {
      const value = previous[key];
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
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

  it("uses the unpooled Neon URL wherever a direct connection is needed", () => {
    const direct = "postgres://user:pass@ep-abc.us-east-2.aws.neon.tech/neondb?sslmode=require";
    const pooled = "postgres://user:pass@ep-abc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
    delete process.env.DATABASE_DIRECT;
    process.env.DATABASE_URL = pooled;
    process.env.DATABASE_URL_UNPOOLED = direct;
    process.env.POSTGRES_URL_NON_POOLING = "postgres://user:pass@other.example/db";
    expect(directDatabaseUrl()).toBe(direct);
    expect(migrationDatabaseUrl()).toBe(direct);
    expect(runtimeDatabaseUrl()).toBe(pooled);
    expect(pooledNeonUrl(direct)).toBe(direct);
    expect(pooledNeonUrl(pooled)).toBe(pooled);

    delete process.env.DATABASE_URL_UNPOOLED;
    process.env.DATABASE_DIRECT = "1";
    expect(directDatabaseUrl()).toBe("postgres://user:pass@other.example/db");
    expect(pooledNeonUrl("postgres://user:pass@ep-plain.us-east-2.aws.neon.tech/neondb")).toBe(
      "postgres://user:pass@ep-plain.us-east-2.aws.neon.tech/neondb",
    );

    process.env.DATABASE_DIRECT = direct;
    delete process.env.POSTGRES_URL_NON_POOLING;
    expect(directDatabaseUrl()).toBe(direct);
    expect(migrationDatabaseUrl()).toBe(direct);
    expect(migrationDriver(direct)).toBe("neon");
    expect(migrationDriver("postgres://user:pass@127.0.0.1:5432/mandatim")).toBe("pg");
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
