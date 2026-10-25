import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrateLegacySite } from "./legacy-migrate";
import { migrationDriver, pooledNeonUrl, runtimeDatabaseUrl } from "./neon-url";
import { INDEX_STATEMENTS, SCHEMA_STATEMENTS } from "./schema";

export type RunResult = { changes: number };

export interface Db {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...params: unknown[]) => Record<string, unknown>[];
    get: (...params: unknown[]) => Record<string, unknown> | undefined;
    run: (...params: unknown[]) => { changes?: number | bigint };
  };
};

class SqliteDb implements Db {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private raw: SqliteDatabase,
    private direct = false,
  ) {}

  private enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.direct) return Promise.resolve().then(fn);
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const bound = bindParams(params);
    return this.enqueue(() => this.raw.prepare(sql).all(...bound).map((row) => ({ ...row }) as T));
  }

  get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const bound = bindParams(params);
    return this.enqueue(() => {
      const row = this.raw.prepare(sql).get(...bound);
      return row ? ({ ...row } as T) : undefined;
    });
  }

  run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const bound = bindParams(params);
    return this.enqueue(() => {
      const result = this.raw.prepare(sql).run(...bound);
      return { changes: Number(result.changes ?? 0) };
    });
  }

  exec(sql: string): Promise<void> {
    return this.enqueue(() => {
      this.raw.exec(sql);
    });
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.direct) return fn(this);
    return this.enqueue(async () => {
      this.raw.exec("BEGIN IMMEDIATE");
      const tx = new SqliteDb(this.raw, true);
      try {
        const result = await fn(tx);
        this.raw.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          this.raw.exec("ROLLBACK");
        } catch {
          /* already closed */
        }
        throw error;
      }
    });
  }
}

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release?: () => void;
};

class PgDb implements Db {
  constructor(
    private pool: PgClient,
    private client?: PgClient,
  ) {}

  private runner(): PgClient {
    return this.client ?? this.pool;
  }

  private async query(sql: string, params: unknown[] = []) {
    let index = 0;
    const text = sql.replace(/\?/g, () => {
      index += 1;
      return `$${index}`;
    });
    return this.runner().query(text, bindParams(params));
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.query(sql, params);
    return result.rows.map((row) => ({ ...row }) as T);
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params);
    return rows[0];
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const result = await this.query(sql, params);
    return { changes: result.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.query(sql);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.client) return fn(this);
    const pool = this.pool as PgClient & { connect: () => Promise<PgClient> };
    const client = await pool.connect();
    const tx = new PgDb(this.pool, client);
    try {
      await client.query("BEGIN");
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      client.release?.();
    }
  }
}

export async function migrate(db: Db): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.exec(statement);
  }
  await migrateLegacySite(db);
  for (const statement of INDEX_STATEMENTS) {
    await db.exec(statement);
  }
}

export async function createSqliteDb(filename: string): Promise<Db> {
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(filename), { recursive: true });
  }
  const sqlite = (await import("node:sqlite")) as { DatabaseSync: new (path: string) => SqliteDatabase };
  const raw = new sqlite.DatabaseSync(filename);
  raw.exec("PRAGMA foreign_keys = ON");
  if (filename !== ":memory:") raw.exec("PRAGMA journal_mode = WAL");
  const db = new SqliteDb(raw);
  await migrate(db);
  return db;
}

export async function createPgDb(connectionString: string): Promise<Db> {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const ws = await import("ws");
  neonConfig.webSocketConstructor = ws.default;
  const pool = new Pool({
    connectionString: pooledNeonUrl(connectionString),
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  const db = new PgDb(pool);
  await migrate(db);
  return db;
}

/**
 * Apply schema and the parties seed on a direct Postgres connection.
 * Used from the Vercel build. The first request also migrates, through the
 * pooled Neon driver, if this step did not run.
 */
export async function applyPostgresMigrations(connectionString: string): Promise<number> {
  if (migrationDriver(connectionString) === "neon") return migrateOnNeon(connectionString);
  return migrateOnPg(connectionString);
}

async function countParties(db: Db): Promise<number> {
  const count = await db.get<{ c: number | string }>(`SELECT COUNT(*) AS c FROM parties`);
  return Number(count?.c ?? 0);
}

async function migrateOnNeon(connectionString: string): Promise<number> {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const ws = await import("ws");
  neonConfig.webSocketConstructor = ws.default;
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 20_000,
  });
  try {
    const db = new PgDb(pool);
    await migrate(db);
    // Finish the read before finally closes the pool. Returning the promise
    // directly lets pool.end() run while the count query is still open.
    return await countParties(db);
  } finally {
    await pool.end();
  }
}

async function migrateOnPg(connectionString: string): Promise<number> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: withoutChannelBinding(connectionString),
    max: 1,
    connectionTimeoutMillis: 20_000,
    ssl: pgSsl(connectionString),
  });
  try {
    const db = new PgDb(pool as unknown as PgClient);
    await migrate(db);
    return await countParties(db);
  } finally {
    await pool.end();
  }
}

function withoutChannelBinding(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (!parsed.searchParams.has("channel_binding")) return connectionString;
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

function pgSsl(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  let hostname = "";
  let mode: string | null = null;
  try {
    const parsed = new URL(connectionString);
    hostname = parsed.hostname;
    mode = parsed.searchParams.get("sslmode");
  } catch {
    return undefined;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return undefined;
  if (!mode || mode === "disable" || mode === "allow" || mode === "prefer") return undefined;
  return { rejectUnauthorized: mode === "verify-full" || mode === "verify-ca" };
}

let singleton: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!singleton) {
    singleton = openDefault();
  }
  return singleton;
}

function bindParams(params: unknown[]): unknown[] {
  return params.map((value) => (value === undefined ? null : value));
}

async function openDefault(): Promise<Db> {
  const url = runtimeDatabaseUrl();
  if (url) return createPgDb(url);
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required on Vercel. A SQLite file does not persist there.");
  }
  const file = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "mandates.db");
  return createSqliteDb(file);
}

/** Test helper. */
export function resetDbForTests(): void {
  singleton = null;
}
