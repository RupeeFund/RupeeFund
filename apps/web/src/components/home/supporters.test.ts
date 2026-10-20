import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import SignupCard from "../site/SignupCard.astro";
import Supporters from "./Supporters.astro";

async function render(props: Record<string, unknown>, component: unknown = Supporters) {
  const container = await AstroContainer.create();
  return container.renderToString(component as never, { props });
}

const terms = (html: string) =>
  [...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>\s*<dd[^>]*>([^<]*)<\/dd>/g)].map((m) => [
    m[1]?.trim(),
    m[2]?.trim(),
  ]);

describe("the supporter figures", () => {
  it("name each figure as a pledge, in the Indian grouping", async () => {
    const html = await render({
      title: "Pledges so far",
      supporters: { count: 1234, season: 567890, median: 128 },
    });
    expect(terms(html)).toEqual([
      ["supporters", "1,234"],
      ["pledged for each season", "₹5,67,890"],
      ["median monthly pledge", "₹128"],
    ]);
    expect(html).toContain("Live · Updated hourly");
  });

  it("show nothing without figures", async () => {
    expect((await render({ title: "Pledges so far", supporters: null })).trim()).toBe("");
  });
});

describe("the sign-up card", () => {
  it("asks the visitor to join the supporters", async () => {
    const supporters = { count: 1234, season: 567890, median: 128 };
    expect(await render({ supporters }, SignupCard)).toContain(
      "Join 1,234 others who have pledged.",
    );
  });

  it("leaves the line out without figures", async () => {
    expect(await render({}, SignupCard)).not.toContain("Join");
  });
});
