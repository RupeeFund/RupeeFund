import { expect, test } from "@playwright/test";

test.describe("waitlist signup (pre-launch build)", () => {
  test("submitting the waitlist form opens the confirmation page", async ({ page }) => {
    await page.goto("/subscribe");
    await expect(page.locator("#waitlist-form")).toBeVisible();

    await page.fill("#waitlist-name", "Asha Tester");
    await page.fill("#waitlist-email", "asha@example.com");
    await page.check('input[name="amount"][value="128"]');
    await page.fill("#waitlist-months", "12+");
    await page.fill("#waitlist-question", "Who audits the fund?");
    await page.check('input[name="is_foss_user"]');
    await page.check('input[name="is_student"]');
    await page.check("#waitlist-updates");
    await page.click("#waitlist-submit");

    await expect(page).toHaveURL(/\/waitlist-confirmed$/);
  });
});
