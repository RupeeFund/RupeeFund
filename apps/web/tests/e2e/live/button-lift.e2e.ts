import { expect, test } from "@playwright/test";
import { posts } from "../routes.ts";

test("the primary button on a green container lifts over a white shadow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(posts[0]);
  const button = page.locator(".on-green .btn-primary").first();
  await button.hover();
  await expect(button).toHaveCSS("box-shadow", /rgb\(255, 255, 255\) 0px 6px/);
});
