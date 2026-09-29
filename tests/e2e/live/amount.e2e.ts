import { expect, test } from "@playwright/test";

const OTHER = 'input[name="amount"][value="other"]';
const STAMP = process.env.E2E_STAMP ?? "1";

test.describe("choosing a monthly amount", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/subscribe");
  });

  test("typing an amount chooses the other option, so submit is never blocked", async ({
    page,
  }) => {
    await page.fill("#waitlist-amount-other", "250");
    await expect(page.locator(OTHER)).toBeChecked();
  });

  test("typing after a fixed option moves the choice to what was typed", async ({ page }) => {
    await page.check('input[name="amount"][value="128"]');
    await page.fill("#waitlist-amount-other", "250");

    await expect(page.locator(OTHER)).toBeChecked();
    await expect(page.locator('input[name="amount"][value="128"]')).not.toBeChecked();
  });

  test("names the other option on its own, not by concatenating the rupee sign", async ({
    page,
  }) => {
    await expect(page.getByRole("radio", { name: "Another amount", exact: true })).toHaveCount(1);
    await expect(
      page.getByRole("textbox", { name: "Another amount in rupees each month" }),
    ).toHaveCount(1);
  });

  test("the arrow key moves between the fixed options, as one radio group must", async ({
    page,
  }) => {
    await page.focus('input[name="amount"][value="15"]');
    await page.keyboard.press("ArrowRight");

    await expect(page.locator('input[name="amount"][value="128"]')).toBeChecked();
  });

  test("a typed amount reaches the confirmation page", async ({ page }) => {
    await page.fill("#waitlist-name", "Asha Tester");
    await page.fill("#waitlist-email", `other+${STAMP}@example.com`);
    await page.fill("#waitlist-amount-other", "250");
    await page.click("#waitlist-submit");

    await expect(page).toHaveURL(/\/waitlist-confirmed$/);
  });

  test("the browser asks for a typed amount when the other option has none", async ({ page }) => {
    await page.fill("#waitlist-name", "Empty Other");
    await page.fill("#waitlist-email", `empty+${STAMP}@example.com`);
    await page.check(OTHER);
    await page.click("#waitlist-submit");

    await expect(page).toHaveURL(/\/subscribe$/);
    const missing = await page
      .locator("#waitlist-amount-other")
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(missing).toBe(true);
  });

  test("the browser refuses an empty amount before it posts anything", async ({ page }) => {
    await page.fill("#waitlist-name", "No Amount");
    await page.fill("#waitlist-email", `blocked+${STAMP}@example.com`);
    await page.click("#waitlist-submit");

    await expect(page).toHaveURL(/\/subscribe$/);
    const invalid = await page
      .locator('input[name="amount"][value="15"]')
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(invalid).toBe(true);
  });
});
