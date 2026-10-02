import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireAccess } from "./access.ts";
import { createAdminRepo } from "./repo.ts";
import {
  handleExport,
  handleQuestions,
  handleReveal,
  handleSummary,
  handleWaitlist,
  NO_STORE,
  PANEL_HEADER,
  SUMMARY_MAX_AGE,
  type RouteDeps,
  type SummaryCache,
} from "./routes.ts";
import { PAGE_SIZE } from "./sql.ts";
import { makeCtx, makeLogger } from "./testkit.ts";
import { makeSqlite, type SqliteFixture } from "./testkit-sqlite.ts";
import type { AdminEnv, AdminVariables } from "./types.ts";

interface SpyCache extends SummaryCache {
  matches: number;
  puts: Response[];
}

function makeCache(): SpyCache {
  const stored = new Map<string, Response>();
  const spy: SpyCache = {
    matches: 0,
    puts: [],
    async delete(request) {
      return stored.delete(request.url);
    },
    async match(request) {
      spy.matches += 1;
      const hit = stored.get(request.url);
      return hit === undefined ? undefined : hit.clone();
    },
    async put(request, response) {
      spy.puts.push(response.clone());
      stored.set(request.url, response);
    },
  };
  return spy;
}

let fixture: SqliteFixture;
let cache: SpyCache;
let logger: ReturnType<typeof makeLogger>;
let deps: RouteDeps;

beforeEach(() => {
  fixture = makeSqlite();
  cache = makeCache();
  logger = makeLogger();
  deps = { repo: createAdminRepo(fixture.db), cache, log: logger.log };
});

afterEach(() => {
  fixture.close();
});

function makeApp() {
  const app = new Hono<{ Bindings: AdminEnv; Variables: AdminVariables }>();
  app.use("*", requireAccess(logger.log));
  app.get("/api/summary", (c) => handleSummary(c, deps));
  app.get("/api/waitlist", (c) => handleWaitlist(c, deps));
  app.get("/api/questions", (c) => handleQuestions(c, deps));
  app.get("/api/reveal/:id", (c) => handleReveal(c, deps));
  app.post("/api/export", (c) => handleExport(c, deps));
  return app;
}

const READER = { email: "volunteer@example.org" };

const PANEL = { [PANEL_HEADER]: "1" };

function call(
  path: string,
  identity: typeof READER | Record<string, never> = READER,
  headers: Record<string, string> = PANEL,
) {
  return makeApp().request(
    `http://admin.test${path}`,
    { headers },
    { DB: fixture.db, ACCESS_AUD: "test-aud" },
    makeCtx(identity),
  );
}

describe("/api/summary", () => {
  it("checks access before the cache", async () => {
    const res = await makeApp().request(
      "http://admin.test/api/summary",
      {},
      { DB: fixture.db, ACCESS_AUD: "test-aud" },
      makeCtx(),
    );
    expect(res.status).toBe(403);
    expect(cache.matches).toBe(0);
  });

  it("serves the counts to a reader", async () => {
    fixture.seed([{ email: "a@example.org" }, { email: "b@example.org" }]);
    const res = await call("/api/summary");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totals: { total: number } };
    expect(body.totals.total).toBe(2);
  });

  it("stamps the counts with the time it read them, for the projection", async () => {
    const before = Date.now();
    const body = (await (await call("/api/summary")).json()) as { asOf: number };
    expect(body.asOf).toBeGreaterThanOrEqual(before);
    expect(body.asOf).toBeLessThanOrEqual(Date.now());
  });

  it("stores the counts for a minute, because they carry no personal data", async () => {
    const res = await call("/api/summary");
    expect(res.headers.get("cache-control")).toBe(`max-age=${SUMMARY_MAX_AGE}`);
    expect(cache.puts).toHaveLength(1);
  });

  it("answers the second reader from the cache without touching the database", async () => {
    fixture.seed([{ email: "a@example.org" }]);
    await call("/api/summary");
    fixture.seed([{ email: "b@example.org" }]);
    const res = await call("/api/summary");
    const body = (await res.json()) as { totals: { total: number } };
    expect(body.totals.total).toBe(1);
    expect(cache.puts).toHaveLength(1);
  });
});

describe("/api/waitlist", () => {
  it("masks the email of every row it returns", async () => {
    fixture.seed([{ email: "someone@example.org" }]);
    const res = await call("/api/waitlist");
    const body = (await res.json()) as { rows: { email_masked: string }[] };
    expect(body.rows[0]?.email_masked).toBe("••••@•••••.org");
    expect(JSON.stringify(body)).not.toContain("someone@example.org");
  });

  it("forbids caching of a PII response", async () => {
    const res = await call("/api/waitlist");
    expect(res.headers.get("cache-control")).toBe(NO_STORE);
  });

  it("sends a flag for a question, never the words the questions table reads", async () => {
    fixture.seed([{ email: "asks@example.org", question: "a private worry" }]);
    const res = await call("/api/waitlist");
    const body = await res.text();
    expect(body).not.toContain("a private worry");
    expect(JSON.parse(body).rows[0].has_question).toBe(1);
  });

  it("hands back a cursor when a further page exists", async () => {
    fixture.seed(Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ email: `p${i}@example.org` })));
    const res = await call("/api/waitlist");
    const body = (await res.json()) as { rows: { id: number }[]; next: number | null };
    expect(body.rows).toHaveLength(PAGE_SIZE);
    expect(body.next).toBe(2);
  });

  it("hands back no cursor on the last page", async () => {
    fixture.seed([{ email: "only@example.org" }]);
    const body = (await (await call("/api/waitlist")).json()) as { next: number | null };
    expect(body.next).toBeNull();
  });

  it("refuses a cursor that is not a positive whole number", async () => {
    for (const cursor of ["0", "-1", "abc", "1.5", "", "9007199254740993"]) {
      const res = await call(`/api/waitlist?before=${cursor}`);
      expect(res.status).toBe(400);
    }
  });
});

describe("/api/questions", () => {
  it("masks the email of every row it returns", async () => {
    fixture.seed([{ email: "someone@example.org", question: "How do I help?" }]);
    const res = await call("/api/questions");
    const body = (await res.json()) as { rows: { email_masked: string }[] };
    expect(body.rows[0]?.email_masked).toBe("••••@•••••.org");
    expect(JSON.stringify(body)).not.toContain("someone@example.org");
  });

  it("forbids caching of a PII response", async () => {
    const res = await call("/api/questions");
    expect(res.headers.get("cache-control")).toBe(NO_STORE);
  });

  it("hands back a cursor when a further page exists", async () => {
    fixture.seed(
      Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
        email: `p${i}@example.org`,
        question: "why?",
      })),
    );
    const body = (await (await call("/api/questions")).json()) as {
      rows: { id: number }[];
      next: number | null;
    };
    expect(body.rows).toHaveLength(PAGE_SIZE);
    expect(body.next).toBe(2);
  });
});

describe("/api/reveal/:id", () => {
  it("returns the one address asked for", async () => {
    fixture.seed([{ email: "someone@example.org" }]);
    const res = await call("/api/reveal/1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 1, email: "someone@example.org" });
  });

  it("logs the actor and the row, never the address", async () => {
    fixture.seed([{ email: "someone@example.org" }]);
    await call("/api/reveal/1");
    expect(logger.entries).toEqual([{ event: "reveal", actor: "volunteer@example.org", id: 1 }]);
    expect(JSON.stringify(logger.entries)).not.toContain("someone@example.org");
  });

  it("forbids caching of a PII response", async () => {
    fixture.seed([{ email: "someone@example.org" }]);
    const res = await call("/api/reveal/1");
    expect(res.headers.get("cache-control")).toBe(NO_STORE);
  });

  it("refuses an identity that carries no email", async () => {
    fixture.seed([{ email: "someone@example.org" }]);
    const res = await call("/api/reveal/1", {});
    expect(res.status).toBe(403);
    expect(logger.entries[0]?.event).toBe("reveal_denied");
    expect(await res.text()).not.toContain("someone@example.org");
  });

  it("reports a row that is absent, and logs the attempt", async () => {
    const res = await call("/api/reveal/99");
    expect(res.status).toBe(404);
    expect(logger.entries[0]?.event).toBe("reveal_miss");
  });

  it("refuses a reveal the panel did not send, so a link elsewhere logs none", async () => {
    fixture.seed([{ email: "someone@example.org" }]);
    const res = await call("/api/reveal/1", READER, {});
    expect([res.status, logger.entries]).toEqual([
      403,
      [{ event: "reveal_denied", reason: "cross_site" }],
    ]);
  });

  it("refuses an id that is not a positive whole number", async () => {
    for (const id of ["0", "-3", "abc", "1.5"]) {
      const res = await call(`/api/reveal/${id}`);
      expect(res.status).toBe(400);
    }
  });
});

describe("POST /api/export", () => {
  const SAME = { origin: "http://admin.test", ...PANEL };

  function post(
    headers: Record<string, string>,
    identity: typeof READER | Record<string, never> = READER,
  ) {
    return makeApp().request(
      "http://admin.test/api/export",
      { method: "POST", headers },
      { DB: fixture.db, ACCESS_AUD: "test-aud" },
      makeCtx(identity),
    );
  }

  function stamped(): number {
    const row = fixture.raw
      .prepare("SELECT COUNT(*) AS n FROM waitlist WHERE exported_at IS NOT NULL")
      .get() as { n: number };
    return row.n;
  }

  it("sends the pending rows as a CSV file that no cache keeps, and stamps them", async () => {
    fixture.seed([{ email: "a@example.org" }, { email: "b@example.org", unsubscribed_at: 5 }]);
    const res = await post(SAME);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="rupeefund-export-\d+\.csv"$/,
    );
    expect(res.headers.get("cache-control")).toBe(NO_STORE);
    expect(res.headers.get("x-export-count")).toBe("1");
    const body = await res.text();
    expect(body).toContain("a@example.org");
    expect(body).not.toContain("b@example.org");
    expect(stamped()).toBe(1);
  });

  it("logs the actor, the stamp time and the count, never an address", async () => {
    fixture.seed([{ email: "a@example.org" }]);
    await post(SAME);
    const entry = logger.entries.find((e) => e.event === "export");
    expect(entry).toMatchObject({ actor: READER.email, count: 1 });
    expect(typeof entry?.at).toBe("number");
    expect(JSON.stringify(logger.entries)).not.toContain("a@example.org");
  });

  it("drops the cached counts, so the next summary shows the new pending count", async () => {
    fixture.seed([{ email: "a@example.org" }]);
    await call("/api/summary");
    await post(SAME);
    const res = await call("/api/summary");
    const body = (await res.json()) as { totals: { pending: number } };
    expect(body.totals.pending).toBe(0);
  });

  it("answers 204 and writes no file when nobody is pending", async () => {
    const res = await post(SAME);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  for (const [name, headers] of [
    ["no panel header", { origin: "http://admin.test" }],
    ["no origin", PANEL],
    ["another origin", { origin: "https://evil.example", ...PANEL }],
  ] as const) {
    it(`refuses a request with ${name}, and stamps nothing`, async () => {
      fixture.seed([{ email: "a@example.org" }]);
      const res = await post(headers);
      expect(res.status).toBe(403);
      expect(stamped()).toBe(0);
      expect(logger.entries.some((e) => e.event === "export_denied")).toBe(true);
    });
  }

  it("refuses an identity that carries no email, and stamps nothing", async () => {
    fixture.seed([{ email: "a@example.org" }]);
    const res = await post(SAME, {});
    expect(res.status).toBe(403);
    expect(stamped()).toBe(0);
  });
});
