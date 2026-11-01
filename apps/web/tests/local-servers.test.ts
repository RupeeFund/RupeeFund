import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { portsFor, portsInUse } from "../scripts/local-servers.mjs";

describe("portsFor", () => {
  it("names the dev and admin ports for the dev state, and the preview port for the preview state", () => {
    expect(portsFor(resolve("../../.wrangler/state"))).toEqual([8787, 8788]);
    expect(portsFor(resolve("../../.wrangler/preview"))).toEqual([8789]);
  });

  it("names the same ports when it runs from another folder", () => {
    const script = resolve("scripts/local-servers.mjs");
    const state = resolve("../../.wrangler/state");
    const out = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m = await import(${JSON.stringify(script)}); console.log(JSON.stringify(m.portsFor(${JSON.stringify(state)})))`,
      ],
      { cwd: tmpdir(), encoding: "utf8", timeout: 10_000 },
    );
    expect(JSON.parse(out)).toEqual([8787, 8788]);
  });

  it.skipIf(process.platform === "win32")(
    "names the same ports when .wrangler is a symlink",
    () => {
      const root = mkdtempSync(join(tmpdir(), "rf-checkout-"));
      const elsewhere = mkdtempSync(join(tmpdir(), "rf-wrangler-"));
      try {
        mkdirSync(join(root, "apps/web/scripts"), { recursive: true });
        copyFileSync(
          resolve("scripts/local-servers.mjs"),
          join(root, "apps/web/scripts/local-servers.mjs"),
        );
        mkdirSync(join(elsewhere, "state"));
        symlinkSync(elsewhere, join(root, ".wrangler"));
        const script = join(root, "apps/web/scripts/local-servers.mjs");
        const out = execFileSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `const m = await import(${JSON.stringify(script)}); console.log(JSON.stringify(m.portsFor(${JSON.stringify(join(root, ".wrangler/state"))})))`,
          ],
          { encoding: "utf8", timeout: 10_000 },
        );
        expect(JSON.parse(out)).toEqual([8787, 8788]);
      } finally {
        rmSync(root, { recursive: true, force: true });
        rmSync(elsewhere, { recursive: true, force: true });
      }
    },
  );

  it("names no port for any other state folder", () => {
    expect(portsFor("/tmp/scratch-state")).toEqual([]);
  });
});

describe("portsInUse", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  it("finds a port that a local server listens on, and skips a free one", async () => {
    server = createServer().listen(0, "localhost");
    await new Promise<void>((done) => {
      server!.once("listening", () => done());
    });
    const address = server.address();
    const busy = typeof address === "object" && address ? address.port : 0;
    const free = await new Promise<number>((done) => {
      const probe = createServer().listen(0, "localhost", () => {
        const { port } = probe.address() as { port: number };
        probe.close(() => done(port));
      });
    });
    expect(await portsInUse([busy, free])).toEqual([busy]);
  });
});
