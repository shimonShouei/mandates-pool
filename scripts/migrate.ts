import { applyPostgresMigrations, getDb } from "../lib/db";
import { migrationDatabaseUrl } from "../lib/neon-url";
import { scheduledResultsRefresh } from "../lib/refresh";

async function main() {
  const url = migrationDatabaseUrl();
  if (!url) {
    console.log(
      "No Postgres URL; skipping schema migrate. SQLite migrates when the file opens, and Postgres migrates again on the first request.",
    );
    return;
  }
  const parties = await applyPostgresMigrations(url);
  if (parties < 1) throw new Error("Schema migrated but the parties list is empty.");
  console.log(`Postgres schema is ready (${parties} parties).`);
  try {
    const report = await scheduledResultsRefresh(await getDb());
    console.log(JSON.stringify({ resultsRefresh: report }));
  } catch (error) {
    console.error("Official results refresh did not finish during build.", error);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
