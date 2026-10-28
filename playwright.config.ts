import { defineConfig, devices } from "@playwright/test";

const port = 38472;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "he-IL",
  },
  webServer: {
    command: `rm -f "$SQLITE_PATH" /tmp/mandatim-e2e.json && npx tsx scripts/seed-e2e.ts && npx next start -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      SQLITE_PATH: "/tmp/mandatim-e2e.db",
      AUTH_SECRET: "e2e-only-secret-not-for-production",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], channel: "chrome", viewport: { width: 390, height: 844 }, isMobile: true },
    },
  ],
});
