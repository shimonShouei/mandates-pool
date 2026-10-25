import autocannon from "autocannon";

const base = (process.env.LOAD_BASE_URL || "http://127.0.0.1:38472").replace(/\/$/, "");
const paths = ["/", "/board", "/crowd", "/scoring", "/api/leaderboard", "/api/crowd"];

const leaderboard = await fetch(`${base}/api/leaderboard`);
if (!leaderboard.ok) {
  console.error(`leaderboard ${leaderboard.status}`);
  process.exit(1);
}
const cache = leaderboard.headers.get("cache-control") || "";
if (!cache.includes("s-maxage=30")) {
  console.error(`leaderboard cache-control is ${cache || "missing"}`);
  process.exit(1);
}

let failed = 0;
for (const path of paths) {
  const result = await autocannon({
    url: `${base}${path}`,
    connections: 8,
    duration: 2,
    timeout: 10,
  });
  const codes = result.statusCodeStats || {};
  const errors = (result.errors || 0) + (result.timeouts || 0) + (result.non2xx || 0);
  console.log(
    `${path}  requests=${result.requests.total}  p95=${result.latency.p97_5}ms  non2xx=${result.non2xx}  codes=${JSON.stringify(codes)}`,
  );
  if (errors > 0) failed += 1;
}

if (failed > 0) {
  console.error(`${failed} paths returned errors`);
  process.exit(1);
}
console.log("read load ok");
