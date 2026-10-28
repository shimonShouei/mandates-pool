export {};

const base = (process.env.SMOKE_BASE_URL || "https://mandates-pool.vercel.app").replace(/\/$/, "");

const pages = ["/", "/board", "/crowd", "/scoring", "/signin"];
const jsonRoutes = ["/api/leaderboard", "/api/crowd"];

async function get(path: string) {
  const response = await fetch(`${base}${path}`, { redirect: "follow" });
  const type = response.headers.get("content-type") || "";
  const body = await response.text();
  return { path, status: response.status, type, body, cache: response.headers.get("cache-control") || "" };
}

async function main() {
  const failures: string[] = [];

  for (const path of pages) {
    const page = await get(path);
    if (page.status !== 200) failures.push(`${path} status ${page.status}`);
    if (!page.body.includes("מנדטים")) failures.push(`${path} is missing the Hebrew title`);
    if (!page.body.includes('dir="rtl"') && !page.body.includes("dir=rtl")) failures.push(`${path} is not RTL`);
  }

  const missing = await get("/this-page-is-not-real");
  if (missing.status !== 404) failures.push(`unknown page status ${missing.status}`);

  const robots = await get("/robots.txt");
  if (robots.status !== 200) failures.push(`robots status ${robots.status}`);
  if (!robots.body.includes("Disallow: /admin")) failures.push("robots does not hide /admin");

  const image = await fetch(`${base}/opengraph-image`);
  const imageType = image.headers.get("content-type") || "";
  if (image.status !== 200 || !imageType.includes("image/png")) {
    failures.push(`opengraph-image ${image.status} ${imageType}`);
  }
  await image.arrayBuffer();

  for (const path of jsonRoutes) {
    const route = await get(path);
    if (route.status !== 200) failures.push(`${path} status ${route.status}`);
    try {
      JSON.parse(route.body);
    } catch {
      failures.push(`${path} is not JSON`);
    }
    if (path === "/api/leaderboard" && !route.cache.includes("s-maxage")) {
      failures.push("leaderboard is missing a shared cache header");
    }
  }

  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`smoke ok ${base}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
