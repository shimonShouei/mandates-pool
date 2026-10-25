import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authModes } from "./auth-modes";
import { deploymentHost } from "./public-origin";
import { SEED_PARTIES } from "./parties";

describe("Vercel deploy settings", () => {
  it("schedules the results refresh at most once a day", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(vercel.crons).toHaveLength(1);
    expect(vercel.crons[0]?.path).toBe("/api/cron/refresh-results");
    const [minute, hour, dayOfMonth, month, dayOfWeek] = vercel.crons[0].schedule.split(/\s+/);
    expect(minute).toMatch(/^\d+$/);
    expect(hour).toMatch(/^\d+$/);
    expect(dayOfMonth).toBe("*");
    expect(month).toBe("*");
    expect(dayOfWeek).toBe("*");
  });

  it("hides Google and Resend in production when their vars are missing", () => {
    const env = {
      NODE_ENV: "production",
      AUTH_SECRET: "present",
      VERCEL_URL: "mandates-pool.vercel.app",
    } as NodeJS.ProcessEnv;
    expect(authModes(env)).toEqual({ google: false, email: false, devInbox: false });
    expect(authModes({ ...env, AUTH_GOOGLE_ID: "id" })).toEqual({ google: false, email: false, devInbox: false });
    expect(authModes({ ...env, AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" }).google).toBe(true);
    expect(authModes({ ...env, AUTH_RESEND_KEY: "re_test" })).toMatchObject({ email: true, devInbox: false });
  });

  it("keeps the dev inbox outside production and treats AUTH_URL as optional", () => {
    expect(authModes({ NODE_ENV: "development" })).toEqual({
      google: false,
      email: true,
      devInbox: true,
    });
    expect(deploymentHost({ NODE_ENV: "production", VERCEL_URL: "mandates-pool.vercel.app" })).toBe(
      "mandates-pool.vercel.app",
    );
    expect(
      deploymentHost({
        NODE_ENV: "production",
        VERCEL_URL: "mandates-pool.vercel.app",
        AUTH_URL: "https://mandates.example",
      }),
    ).toBeNull();
    expect(deploymentHost({ NODE_ENV: "production" })).toBeNull();
  });

  it("ships a parties seed for an empty database", () => {
    expect(SEED_PARTIES.length).toBeGreaterThan(0);
    expect(new Set(SEED_PARTIES.map((party) => party.name)).size).toBe(SEED_PARTIES.length);
  });
});
