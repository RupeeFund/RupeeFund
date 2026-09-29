/// <reference lib="dom" />
// The evaluate callback runs in the browser. The DOM lib stays scoped to the
// files that need it rather than widening tsconfig.node.json.
import { expect, test } from "@playwright/test";

const NARROW = { width: 360, height: 900 };

test.describe("the external-link arrow on a wrapped link", () => {
  test("rides in the flow of the last line instead of anchoring to the link box", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/privacy");

    const link = page.locator('main a[target="_blank"]').first();
    await link.evaluate((el) => {
      el.textContent = "External resource link";
      el.style.whiteSpace = "normal";
      el.parentElement!.style.width = "100px";
    });
    const seen = await link.evaluate((el) => ({
      lines: el.getClientRects().length,
      arrow: getComputedStyle(el, "::after").position,
      content: getComputedStyle(el, "::after").content,
      anchor: getComputedStyle(el).position,
      gutter: getComputedStyle(el).paddingRight,
    }));

    expect(seen.lines, "the link must wrap for this test to mean anything").toBeGreaterThan(1);

    // An out-of-flow arrow anchors to the union of every line box, so on a
    // wrapped link it lands at the right margin, half way down.
    // A missing ::after also computes to `static`, so assert it exists first.
    expect(seen.content, "the arrow must be painted at all").not.toBe("none");
    expect(seen.arrow, "the arrow must stay in flow").toBe("static");
    expect(seen.anchor, "a positioned anchor is what strands the arrow").not.toBe("relative");
    expect(seen.gutter, "only an out-of-flow arrow needed a reserved gutter").toBe("0px");
  });
});
