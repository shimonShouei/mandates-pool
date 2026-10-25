import { applyPostgresMigrations } from "../lib/db";
import { migrationDatabaseUrl } from "../lib/neon-url";

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
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
