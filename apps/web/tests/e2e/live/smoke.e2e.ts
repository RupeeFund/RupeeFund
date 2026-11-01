import { expect, test } from "@playwright/test";
import { routes } from "../routes.ts";

const ERROR_PAGES = ["/404", "/500"];

test.describe("public pages smoke", () => {
  for (const path of routes.filter((route) => !ERROR_PAGES.includes(route))) {
    test(`${path} renders with a title, one heading and one main landmark`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(/\S/);
      await expect(page.locator("main#main")).toHaveCount(1);
    });
  }

  test("the old team path redirects to the people page", async ({ page }) => {
    const response = await page.request.fetch("/team", { maxRedirects: 0 });
    expect([response.status(), response.headers()["location"]]).toEqual([302, "/people"]);
  });

  test("the admin path opens the content manager", async ({ page }) => {
    const response = await page.request.fetch("/admin", { maxRedirects: 0 });
    expect([response.status(), response.headers()["location"]]).toEqual([302, "/_emdash/admin"]);
  });

  test("an unknown route serves the 404 page", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveCount(1);
  });
});
