import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

function seedMeta() {
  return JSON.parse(readFileSync("/tmp/mandatim-e2e.json", "utf8")) as { code: string; alias: string };
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", () => {
    throw new Error("A page opened a dialog");
  });
});

test("home is Hebrew, right to left, and offers both ways in", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.getByRole("heading", { level: 1, name: "מנדטים" })).toBeVisible();
  await expect(page.getByText("ימים")).toBeVisible();
  await expect(page.getByRole("link", { name: "פתיחת קבוצה" })).toBeVisible();
  await expect(page.getByRole("link", { name: "יש לי קוד" })).toBeVisible();
  await page.locator("#code").fill("NO-SUCH-CODE");
  await page.getByRole("button", { name: "כניסה לקבוצה" }).click();
  await expect(page.getByRole("heading", { name: "אין קבוצה כזאת" })).toBeVisible();
});

test("public pages, a missing page, robots, and the share image", async ({ page }) => {
  const meta = seedMeta();
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "הדירוג הארצי" })).toBeVisible();
  await expect(page.getByRole("listitem").getByText(meta.alias)).toBeVisible();
  await expect(page.locator("svg[onload]")).toHaveCount(0);

  await page.goto("/crowd");
  await expect(page.getByRole("heading", { name: "חוכמת ההמונים" })).toBeVisible();

  await page.goto("/scoring");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/signin");
  await expect(page.getByText("הכניסה עוד לא הוגדרה")).toBeVisible();

  const missing = await page.goto("/no-such-page");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "העמוד לא נמצא" })).toBeVisible();

  await page.goto(`/g/${meta.code}`);
  await expect(page.getByRole("heading", { name: "<script>alert(1)</script>" })).toBeVisible();
  await expect(page.locator("svg[onload]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "כניסה" }).first()).toBeVisible();
  await expect(page.locator("input[inputmode=numeric]")).toHaveCount(0);
});

test("robots and the open graph image are served", async ({ request }) => {
  const meta = seedMeta();
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const body = await robots.text();
  expect(body).toContain("Disallow: /admin");
  expect(body).toContain("Disallow: /api/");
  expect(body).toContain("Disallow: /me");

  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const groupImage = await request.get(`/g/${meta.code}/opengraph-image`);
  expect(groupImage.status()).toBe(200);
  expect(groupImage.headers()["content-type"]).toContain("image/png");

  const board = await request.get("/api/leaderboard");
  expect(board.status()).toBe(200);
  expect(board.headers()["cache-control"]).toContain("s-maxage=30");
  const payload = (await board.json()) as { rows: { alias: string }[] };
  expect(payload.rows.some((row) => row.alias === meta.alias)).toBe(true);
});
