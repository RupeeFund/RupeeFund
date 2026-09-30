import { describe, expect, it } from "vitest";
import { ASSETS, FAVICON, STYLESHEET } from "../.generated/assets.ts";
import { IMMUTABLE } from "./assets.ts";
import { callWorker } from "./testkit.ts";

const READER = { email: "volunteer@example.org" };

describe("the served assets", () => {
  it("serves the stylesheet as CSS that the browser may keep", async () => {
    const res = await callWorker(STYLESHEET, READER);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(await res.text()).toContain("font-family: 'Inter Variable'");
  });

  it("resolves every file the stylesheet names", async () => {
    const css = await (await callWorker(STYLESHEET, READER)).text();
    const named = [...css.matchAll(/url\((\/assets\/[^)]+)\)/g)].map((hit) => hit[1]);
    expect(named).toHaveLength(2);
    for (const path of named) expect(ASSETS[path]?.type).toBe("font/woff2");
  });

  it("serves the brand mark as SVG", async () => {
    const res = await callWorker(FAVICON, READER);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(await res.text()).toContain("<svg");
  });

  it("answers an unknown asset with not found", async () => {
    expect((await callWorker("/assets/nope.css", READER)).status).toBe(404);
  });
});
