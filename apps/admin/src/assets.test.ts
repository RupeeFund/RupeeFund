import { describe, expect, it } from "vitest";
import { ASSETS, LOGO, STYLESHEET } from "../.generated/assets.ts";
import { IMMUTABLE } from "./assets.ts";
import worker from "./index.ts";
import { makeCtx, makeEnv } from "./testkit.ts";

const READER = { email: "volunteer@example.org" };

function call(path: string, identity?: { email: string }) {
  return worker.fetch(
    new Request(`https://admin.rupeefund.org${path}`),
    makeEnv(),
    makeCtx(identity),
  );
}

describe("the served assets", () => {
  it("serves the stylesheet as CSS that the browser may keep", async () => {
    const res = await call(STYLESHEET, READER);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(await res.text()).toContain("font-family: 'Inter Variable'");
  });

  it("resolves every file the stylesheet names", async () => {
    const css = await (await call(STYLESHEET, READER)).text();
    const named = [...css.matchAll(/url\((\/assets\/[^)]+)\)/g)].map((hit) => hit[1]);
    expect(named).toHaveLength(2);
    for (const path of named) expect(ASSETS[path]?.type).toBe("font/woff2");
  });

  it("serves the logo as SVG", async () => {
    const res = await call(LOGO, READER);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(await res.text()).toContain("<svg");
  });

  it("answers an unknown asset with not found", async () => {
    expect((await call("/assets/nope.css", READER)).status).toBe(404);
  });

  it("serves nothing to a request that Access did not authenticate", async () => {
    expect((await call(STYLESHEET)).status).toBe(403);
  });
});
