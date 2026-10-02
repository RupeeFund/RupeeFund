import { expect, test } from "@playwright/test";

test.describe("waitlist signup with JavaScript disabled", () => {
  test("submitting the form records the signup and lands on a confirmation page", async ({
    page,
  }) => {
    await page.goto("/subscribe");
    await page.fill("#waitlist-name", "No Script");
    await page.fill("#waitlist-email", "nojs@example.com");
    await page.check('input[name="amount"][value="other"]');
    await page.fill("#waitlist-amount-other", "250");
    await page.check('input[name="is_creator"]');
    await page.check("#waitlist-updates");

    await Promise.all([page.waitForURL("**/waitlist-confirmed"), page.click("#waitlist-submit")]);

    await expect(page.locator("main")).toBeVisible();
  });

  test("posts the form, so the address never lands in a URL", async ({ page }) => {
    await page.goto("/subscribe");
    await page.fill("#waitlist-name", "No Script");
    await page.fill("#waitlist-email", "leak@example.com");
    await page.check('input[name="amount"][value="15"]');

    const sent = page.waitForRequest((r) => r.url().includes("/api/waitlist"));
    await Promise.all([page.waitForURL("**/waitlist-confirmed"), page.click("#waitlist-submit")]);
    const request = await sent;

    expect([request.method(), new URL(request.url()).search]).toEqual(["POST", ""]);
    expect(page.url()).not.toContain("@");
  });

  test("refuses to post until an amount is chosen, with no script to enforce it", async ({
    page,
  }) => {
    await page.goto("/subscribe");
    await page.fill("#waitlist-name", "No Amount");
    await page.fill("#waitlist-email", "noamount@example.com");

    await page.click("#waitlist-submit");

    await expect(page).toHaveURL(/\/subscribe$/);
    await expect(page.locator("#waitlist-form")).toBeVisible();
  });
});
