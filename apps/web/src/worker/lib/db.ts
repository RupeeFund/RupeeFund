import type { D1Database } from "@cloudflare/workers-types";
import { REASON_FIELDS, ROLE_FIELDS } from "@rupeefund/db/schema";
import type { Repo, WaitlistEntry } from "../types.ts";

const COLUMNS = [
  "email",
  "name",
  "consent_at",
  "source",
  "amount",
  "months",
  "question",
  "updates_opt_in",
  ...ROLE_FIELDS,
  ...REASON_FIELDS,
  "created_at",
  "updated_at",
] as const satisfies readonly (keyof WaitlistEntry)[];

const INSERT = `INSERT INTO waitlist (${COLUMNS.join(", ")})
  VALUES (${COLUMNS.map(() => "?").join(", ")})
  ON CONFLICT (email) DO NOTHING`;

export function createRepo(db: D1Database): Repo {
  return {
    async addToWaitlist(entry) {
      await db
        .prepare(INSERT)
        .bind(...COLUMNS.map((column) => entry[column]))
        .run();
    },
  };
}
