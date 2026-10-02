import { expect, test } from "@playwright/test";

test.describe("waitlist signup with JavaScript disabled", () => {
  test("shows a notice in place of the form, because the bot check needs JavaScript", async ({
    page,
  }) => {
    await page.goto("/subscribe");

    await expect(page.locator("#waitlist-form")).toBeHidden();
    const notice = page.locator("#waitlist-no-js");
    await expect(notice).toBeVisible();
    await expect(notice.locator('a[href^="mailto:"]')).toBeVisible();
  });
});
