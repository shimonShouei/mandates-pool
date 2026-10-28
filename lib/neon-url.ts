const POSTGRES_URL = /^postgres(ql)?:/i;

export function isPostgresUrl(value: string | undefined | null): value is string {
  return Boolean(value && POSTGRES_URL.test(value.trim()));
}

/**
 * Direct (non-pooler) Postgres URL.
 * `DATABASE_DIRECT` may be the flag `1` or a full URL. When it is not a URL,
 * the Neon integration's `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING`
 * is the direct connection, so that variable does not need to be set on Vercel.
 */
export function directDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (isPostgresUrl(env.DATABASE_DIRECT)) return env.DATABASE_DIRECT.trim();
  if (isPostgresUrl(env.DATABASE_URL_UNPOOLED)) return env.DATABASE_URL_UNPOOLED.trim();
  if (isPostgresUrl(env.POSTGRES_URL_NON_POOLING)) return env.POSTGRES_URL_NON_POOLING.trim();
  return undefined;
}

/** Pooled URL used for ordinary queries. */
export function runtimeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (isPostgresUrl(env.DATABASE_URL)) return env.DATABASE_URL.trim();
  if (isPostgresUrl(env.POSTGRES_URL)) return env.POSTGRES_URL.trim();
  return undefined;
}

/** Schema changes prefer the direct URL, then the runtime URL. */
export function migrationDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return directDatabaseUrl(env) ?? runtimeDatabaseUrl(env);
}

/** Neon hosts are migrated with the Neon driver. Other Postgres uses node-postgres. */
export function migrationDriver(connectionString: string): "neon" | "pg" {
  try {
    if (new URL(connectionString).hostname.endsWith(".neon.tech")) return "neon";
  } catch {
    return "pg";
  }
  return "pg";
}

/** Point a Neon host at the pooled endpoint. Other Postgres URLs are left alone. */
export function pooledNeonUrl(connectionString: string, env: NodeJS.ProcessEnv = process.env): string {
  if (keepDirect(connectionString, env)) return connectionString;
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return connectionString;
  }
  if (!parsed.hostname.endsWith(".neon.tech")) return connectionString;
  if (parsed.hostname.includes("-pooler")) return connectionString;
  const labels = parsed.hostname.split(".");
  labels[0] = `${labels[0]}-pooler`;
  parsed.hostname = labels.join(".");
  return parsed.toString();
}

function keepDirect(connectionString: string, env: NodeJS.ProcessEnv): boolean {
  if (env.DATABASE_DIRECT === "1") return true;
  const direct = directDatabaseUrl(env);
  return Boolean(direct && sameDatabase(direct, connectionString));
}

function sameDatabase(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol === b.protocol && a.host === b.host && a.pathname === b.pathname;
  } catch {
    return left === right;
  }
}
