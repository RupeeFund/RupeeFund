import { createServer, type Server } from "node:net";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { portsFor, portsInUse } from "../scripts/local-servers.mjs";

describe("portsFor", () => {
  it("names the dev and admin ports for the dev state, and the preview port for the preview state", () => {
    expect(portsFor(resolve("../../.wrangler/state"))).toEqual([8787, 8788]);
    expect(portsFor(resolve("../../.wrangler/preview"))).toEqual([8789]);
  });

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
