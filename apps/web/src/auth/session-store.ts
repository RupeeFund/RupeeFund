interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
}

export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
}

export interface SessionStore {
  name: string;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const TABLE = "rupeefund_sessions";
export const CREATE_SESSIONS =
  `CREATE TABLE IF NOT EXISTS ${TABLE} ` +
  "(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)";
const UPSERT =
  `INSERT INTO ${TABLE} (key, value, updated_at) VALUES (?, ?, unixepoch()) ` +
  "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at";
const IDLE_SECONDS = 24 * 60 * 60;

export function sessionStore(database: () => SqlDatabase): SessionStore {
  let ready: Promise<void> | undefined;
  const db = async (): Promise<SqlDatabase> => {
    const handle = database();
    ready ??= (async () => {
      await handle.prepare(CREATE_SESSIONS).run();
      await handle
        .prepare(`DELETE FROM ${TABLE} WHERE updated_at < unixepoch() - ?`)
        .bind(IDLE_SECONDS)
        .run();
    })().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    await ready;
    return handle;
  };
  return {
    name: "rupeefund-d1",
    async getItem(key) {
      const row = await (
        await db()
      )
        .prepare(`SELECT value FROM ${TABLE} WHERE key = ?`)
        .bind(key)
        .first<{ value: string }>();
      return row?.value ?? null;
    },
    async setItem(key, value) {
      await (await db()).prepare(UPSERT).bind(key, value).run();
    },
    async removeItem(key) {
      await (await db()).prepare(`DELETE FROM ${TABLE} WHERE key = ?`).bind(key).run();
    },
  };
}
