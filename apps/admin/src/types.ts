import type { CloudflareAccessContext, D1Database } from "@cloudflare/workers-types";

export interface AdminEnv {
  DB: D1Database;
}

export interface AdminVariables {
  access: CloudflareAccessContext;
}

export type AdminLogger = (event: Record<string, unknown>) => void;
