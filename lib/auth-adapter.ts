import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from "@auth/core/adapters";
import type { Db } from "./db";
import { getDb } from "./db";
import { newId } from "./ids";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  email_verified: string | null;
  image: string | null;
};

function iso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function mapUser(row: UserRow): AdapterUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.email_verified ? new Date(row.email_verified) : null,
    image: row.image,
  };
}

function lazyDb(): Db {
  return {
    all: async (sql, params) => (await getDb()).all(sql, params),
    get: async (sql, params) => (await getDb()).get(sql, params),
    run: async (sql, params) => (await getDb()).run(sql, params),
    exec: async (sql) => (await getDb()).exec(sql),
    transaction: async (fn) => (await getDb()).transaction(fn),
  };
}

export function createAuthAdapter(db: Db): Adapter {
  return {
    async createUser(user) {
      const id = user.id || newId();
      const email = user.email.toLowerCase();
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO users (id, name, email, email_verified, image, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, user.name ?? null, email, iso(user.emailVerified), user.image ?? null, now],
      );
      return { ...user, id, email };
    },
    async getUser(id) {
      const row = await db.get<UserRow>(`SELECT id, name, email, email_verified, image FROM users WHERE id = ?`, [id]);
      return row ? mapUser(row) : null;
    },
    async getUserByEmail(email) {
      const row = await db.get<UserRow>(
        `SELECT id, name, email, email_verified, image FROM users WHERE email = ?`,
        [email.toLowerCase()],
      );
      return row ? mapUser(row) : null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const row = await db.get<UserRow>(
        `SELECT u.id, u.name, u.email, u.email_verified, u.image
         FROM users u
         JOIN auth_accounts a ON a.user_id = u.id
         WHERE a.provider = ? AND a.provider_account_id = ?`,
        [provider, providerAccountId],
      );
      return row ? mapUser(row) : null;
    },
    async updateUser(user) {
      const current = await db.get<UserRow>(`SELECT id, name, email, email_verified, image FROM users WHERE id = ?`, [
        user.id,
      ]);
      if (!current) throw new Error("החשבון לא נמצא.");
      const next = mapUser(current);
      if (user.name !== undefined) next.name = user.name;
      if (user.email !== undefined) next.email = user.email.toLowerCase();
      if (user.emailVerified !== undefined) next.emailVerified = user.emailVerified;
      if (user.image !== undefined) next.image = user.image;
      await db.run(`UPDATE users SET name = ?, email = ?, email_verified = ?, image = ? WHERE id = ?`, [
        next.name ?? null,
        next.email,
        iso(next.emailVerified),
        next.image ?? null,
        user.id,
      ]);
      return next;
    },
    async linkAccount(account: AdapterAccount) {
      await db.run(
        `INSERT INTO auth_accounts (
           user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          account.session_state ?? null,
        ],
      );
    },
    async createSession(session) {
      await db.run(`INSERT INTO auth_sessions (session_token, user_id, expires) VALUES (?, ?, ?)`, [
        session.sessionToken,
        session.userId,
        session.expires.toISOString(),
      ]);
      return session;
    },
    async getSessionAndUser(sessionToken) {
      const row = await db.get<UserRow & { session_token: string; user_id: string; expires: string }>(
        `SELECT s.session_token, s.user_id, s.expires, u.id, u.name, u.email, u.email_verified, u.image
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.session_token = ?`,
        [sessionToken],
      );
      if (!row) return null;
      return {
        session: { sessionToken: row.session_token, userId: row.user_id, expires: new Date(row.expires) },
        user: mapUser(row),
      };
    },
    async updateSession(session) {
      const current = await db.get<{ session_token: string; user_id: string; expires: string }>(
        `SELECT session_token, user_id, expires FROM auth_sessions WHERE session_token = ?`,
        [session.sessionToken],
      );
      if (!current) return null;
      const next = {
        sessionToken: current.session_token,
        userId: session.userId ?? current.user_id,
        expires: session.expires ?? new Date(current.expires),
      };
      await db.run(`UPDATE auth_sessions SET user_id = ?, expires = ? WHERE session_token = ?`, [
        next.userId,
        next.expires.toISOString(),
        next.sessionToken,
      ]);
      return next;
    },
    async deleteSession(sessionToken) {
      await db.run(`DELETE FROM auth_sessions WHERE session_token = ?`, [sessionToken]);
    },
    async createVerificationToken(verificationToken: VerificationToken) {
      await db.run(`INSERT INTO auth_verification_tokens (identifier, token, expires) VALUES (?, ?, ?)`, [
        verificationToken.identifier.toLowerCase(),
        verificationToken.token,
        verificationToken.expires.toISOString(),
      ]);
      return verificationToken;
    },
    async useVerificationToken({ identifier, token }) {
      const row = await db.get<{ identifier: string; token: string; expires: string }>(
        `SELECT identifier, token, expires FROM auth_verification_tokens WHERE identifier = ? AND token = ?`,
        [identifier.toLowerCase(), token],
      );
      if (!row) return null;
      await db.run(`DELETE FROM auth_verification_tokens WHERE identifier = ? AND token = ?`, [row.identifier, row.token]);
      return { identifier: row.identifier, token: row.token, expires: new Date(row.expires) };
    },
  };
}

export function appAuthAdapter(): Adapter {
  return createAuthAdapter(lazyDb());
}
