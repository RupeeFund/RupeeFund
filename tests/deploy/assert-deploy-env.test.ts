import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DUMMY_SITEKEYS, type Result, runNode } from "./helpers.ts";

const GUARD = resolve("scripts/assert-deploy-env.mjs");

function config(): Record<string, unknown> {
  const raw = readFileSync("wrangler.jsonc", "utf8");
  return JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
}

interface Fixture {
  config?: (config: Record<string, unknown>) => void;
  lib?: (source: string) => string;
}

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function repoWith(mutate: Fixture): string {
  const dir = mkdtempSync(join(tmpdir(), "trf-guard-"));
  temporary.push(dir);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "src", "lib"), { recursive: true });

  copyFileSync(GUARD, join(dir, "scripts", "assert-deploy-env.mjs"));
  copyFileSync(
    resolve("scripts/turnstile-dummy-keys.mjs"),
    join(dir, "scripts", "turnstile-dummy-keys.mjs"),
  );

  const next = config();
  mutate.config?.(next);
  writeFileSync(join(dir, "wrangler.jsonc"), JSON.stringify(next));

  const lib = readFileSync("src/lib/turnstile.ts", "utf8");
  writeFileSync(join(dir, "src", "lib", "turnstile.ts"), mutate.lib?.(lib) ?? lib);
  return dir;
}

function run(env: Record<string, string>, cwd = process.cwd()): Result {
  const guard = cwd === process.cwd() ? GUARD : join(cwd, "scripts", "assert-deploy-env.mjs");
  return runNode(guard, { cwd, env: { PATH: process.env.PATH ?? "", ...env } });
}

function withSitekey(value: string) {
  return (source: string) =>
    source.replace(
      /export const TURNSTILE_SITEKEY = "[^"]*"/,
      `export const TURNSTILE_SITEKEY = "${value}"`,
    );
}

describe("the sitekey comes from the repository, so no dashboard field can be missing", () => {
  it("passes with nothing set in the environment at all", () => {
    expect(run({}).code).toBe(0);
  });

  it("refuses a repository that declares no sitekey at all", () => {
    const dir = repoWith({
      lib: (src) => src.replace(/export const TURNSTILE_SITEKEY = "[^"]*";\r?\n/, ""),
    });
    const { code, stderr } = run({}, dir);
    expect(code).toBe(1);
    expect(stderr).toContain("declares no TURNSTILE_SITEKEY");
  });

  for (const key of DUMMY_SITEKEYS) {
    it(`refuses a repository that declares dummy sitekey ${key}`, () => {
      const dir = repoWith({ lib: withSitekey(key) });
      const { code, stderr } = run({}, dir);
      expect(code).toBe(1);
      expect(stderr).toContain(key);
    });
  }

  it("refuses a Turnstile secret pasted where the sitekey goes", () => {
    const dir = repoWith({ lib: withSitekey("0x4AAAAAAFF1b4zzEwdZwWSXAAAAAAAAAAA") });
    const { code, stderr } = run({}, dir);
    expect(code).toBe(1);
    expect(stderr).toContain("the secret");
  });

  it("accepts another real sitekey, so a rotation is not blocked", () => {
    const dir = repoWith({ lib: withSitekey("0x4AAAAAAEhMNZY_VP1lW8kS") });
    expect(run({}, dir).code).toBe(0);
  });

  for (const key of DUMMY_SITEKEYS) {
    it(`refuses an environment override that is dummy sitekey ${key}`, () => {
      const { code, stderr } = run({ PUBLIC_TURNSTILE_SITEKEY: key });
      expect(code).toBe(1);
      expect(stderr).toContain(key);
    });

    it(`allows the same override behind the explicit opt-in ${key}`, () => {
      const { code } = run({
        PUBLIC_TURNSTILE_SITEKEY: key,
        PUBLIC_ALLOW_TEST_SITEKEY: "true",
      });
      expect(code).toBe(0);
    });
  }
});

describe("the deploy guard refuses a Turnstile configuration that checks nothing", () => {
  it("refuses an empty hostname list, which turns the hostname check off", () => {
    const dir = repoWith({
      config: (c) => {
        (c.vars as Record<string, string>).TURNSTILE_HOSTNAMES = "";
      },
    });
    const { code, stderr } = run({}, dir);
    expect(code).toBe(1);
    expect(stderr).toContain("TURNSTILE_HOSTNAMES is not set");
  });

  it("refuses a development host in the hostname list", () => {
    const dir = repoWith({
      config: (c) => {
        (c.vars as Record<string, string>).TURNSTILE_HOSTNAMES = "localhost";
      },
    });
    const { code, stderr } = run({}, dir);
    expect(code).toBe(1);
    expect(stderr).toContain("development host");
  });

  it("refuses an empty action, which turns the action check off", () => {
    const dir = repoWith({
      config: (c) => {
        (c.vars as Record<string, string>).TURNSTILE_ACTION = "";
      },
    });
    const { code, stderr } = run({}, dir);
    expect(code).toBe(1);
    expect(stderr).toContain("TURNSTILE_ACTION is not set");
  });
});

describe("the project ships exactly one environment", () => {
  it("declares no env block", () => {
    expect(config().env).toBeUndefined();
  });

  it("refuses a configuration that adds one back", () => {
    const dir = repoWith({
      config: (c) => {
        c.env = { beta: { name: "trf-beta" } };
      },
    });
    const { code, stderr } = run({}, dir);
    expect(code).toBe(1);
    expect(stderr).toContain("declares an env block");
  });

  it("names one database and one migrations directory", () => {
    const dbs = config().d1_databases as Record<string, string>[];
    expect(dbs).toHaveLength(1);
    expect(dbs[0].database_name).toBe("rupeefund-waitlist");
    expect(dbs[0].migrations_dir).toBe("migrations");
  });
});

describe("the deploy guard keeps the site off every host but the custom domain", () => {
  it("declares workers_dev and preview_urls false", () => {
    const c = config();
    expect(c.workers_dev).toBe(false);
    expect(c.preview_urls).toBe(false);
  });

  for (const field of ["workers_dev", "preview_urls"] as const) {
    it(`refuses a configuration that leaves ${field} open`, () => {
      const dir = repoWith({
        config: (c) => {
          c[field] = true;
        },
      });
      const { code, stderr } = run({}, dir);
      expect(code).toBe(1);
      expect(stderr).toContain(field);
    });

    it(`refuses a configuration that omits ${field} rather than stating it`, () => {
      const dir = repoWith({
        config: (c) => {
          delete c[field];
        },
      });
      const { code, stderr } = run({}, dir);
      expect(code).toBe(1);
      expect(stderr).toContain(field);
    });
  }
});
