import type { CloudflareAccessContext, D1Database } from "@cloudflare/workers-types";

export interface AdminEnv {
  DB: D1Database;
  ACCESS_AUD: string;
}

export interface AdminVariables {
  access: CloudflareAccessContext;
}

export type AdminLogger = (event: Record<string, unknown>) => void;
