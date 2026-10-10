import { chromium, expect, test } from "@playwright/test";
import { launch, type LaunchedChrome } from "chrome-launcher";
import lighthouse from "lighthouse";
import { posts } from "../routes.ts";

const ROUTES = ["/", "/subscribe", "/blog", posts[0], "/people"];
const MIN_SCORES = { performance: 0.85, accessibility: 1, "best-practices": 1, seo: 1 };
const MAX_METRICS = {
  "largest-contentful-paint": 4000,
  "cumulative-layout-shift": 0.1,
  "total-blocking-time": 200,
  "total-byte-weight": 1_000_000,
};

test.describe.configure({ mode: "default" });

let chrome: LaunchedChrome;

test.beforeAll(async () => {
  chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", ...(process.env.CI ? ["--no-sandbox"] : [])],
  });
});

test.afterAll(() => {
  chrome.kill();
});

for (const route of ROUTES) {
  test(`${route} stays inside the Lighthouse budgets`, async ({ baseURL }) => {
    test.setTimeout(60_000);
    const url = new URL(route, baseURL).href;
    const result = await lighthouse(url, { port: chrome.port, logLevel: "error" });
    const { categories, audits } = result!.lhr;
    for (const [id, min] of Object.entries(MIN_SCORES)) {
      expect(categories[id]?.score ?? 0, id).toBeGreaterThanOrEqual(min);
    }
    for (const [id, max] of Object.entries(MAX_METRICS)) {
      expect(audits[id]?.numericValue ?? Infinity, id).toBeLessThanOrEqual(max);
    }
  });
}
