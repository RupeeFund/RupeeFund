import type { D1Database } from "@cloudflare/workers-types";
import type { Repo } from "../types.ts";

export function createRepo(db: D1Database): Repo {
  return {
    async addToWaitlist(entry) {
      await db
        .prepare(
          `INSERT INTO waitlist
             (email, name, consent_at, source, amount, months, question, updates_opt_in,
              is_foss_user, is_foss_contributor, is_student, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (email) DO NOTHING`,
        )
        .bind(
          entry.email,
          entry.name,
          entry.consent_at,
          entry.source,
          entry.amount,
          entry.months,
          entry.question,
          entry.updates_opt_in,
          entry.is_foss_user,
          entry.is_foss_contributor,
          entry.is_student,
          entry.created_at,
          entry.updated_at,
        )
        .run();
    },
  };
}
