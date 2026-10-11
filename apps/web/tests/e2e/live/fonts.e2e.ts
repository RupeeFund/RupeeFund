import { expect, test } from "@playwright/test";

for (const path of ["/", "/subscribe"]) {
  test(`${path} draws the rupee sign without the extended Latin font`, async ({ page }) => {
    const fonts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fonts.push(new URL(request.url()).pathname);
    });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(fonts.filter((font) => font.includes("inter-rupee"))).toHaveLength(1);
    expect(fonts.filter((font) => font.includes("latin-ext"))).toEqual([]);
  });
}
