import type { CloudflareAccessIdentity, ExecutionContext } from "@cloudflare/workers-types";
import worker from "./index.ts";
import type { AdminEnv } from "./types.ts";

export type SpyD1 = AdminEnv["DB"] & { queries: string[] };

export interface SpyEnv extends AdminEnv {
  DB: SpyD1;
}

export function makeD1(): SpyD1 {
  const queries: string[] = [];
  const statement = {
    bind: () => statement,
    all: async () => ({ success: true, results: [], meta: {} }),
    first: async () => null,
    run: async () => ({ success: true, meta: { changes: 0 } }),
  };
  return {
    queries,
    prepare: (query: string) => {
      queries.push(query);
      return statement;
    },
    batch: async (statements: unknown[]) =>
      statements.map(() => ({ success: true, results: [], meta: {} })),
  } as unknown as SpyD1;
}

export function makeEnv(): SpyEnv {
  return { DB: makeD1(), ACCESS_AUD: "test-aud" };
}

export function makeCtx(identity?: CloudflareAccessIdentity): ExecutionContext {
  const base = {
    waitUntil() {},
    passThroughOnException() {},
  };
  if (identity === undefined) return base as unknown as ExecutionContext;
  return {
    ...base,
    access: {
      aud: "test-aud",
      getIdentity: async () => identity,
    },
  } as unknown as ExecutionContext;
}

export function makeLogger(): {
  entries: Record<string, unknown>[];
  log: (e: Record<string, unknown>) => void;
} {
  const entries: Record<string, unknown>[] = [];
  return { entries, log: (e) => entries.push(e) };
}

export function callWorker(path: string, identity?: CloudflareAccessIdentity): Promise<Response> {
  return worker.fetch(
    new Request(`https://admin.rupeefund.org${path}`),
    makeEnv(),
    makeCtx(identity),
  );
}
