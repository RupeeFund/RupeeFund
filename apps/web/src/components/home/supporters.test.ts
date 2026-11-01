import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Supporters from "./Supporters.astro";

async function render(props: Record<string, unknown>) {
  const container = await AstroContainer.create();
  return container.renderToString(Supporters, { props });
}

const text = (html = "") => html.replace(/<[^>]*>/g, "").trim();

const terms = (html: string) =>
  [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [
    text(m[1]),
    text(m[2]),
  ]);

describe("the supporter figures", () => {
  it("lead with the yearly total, in the Indian grouping", async () => {
    const html = await render({
      title: "Pledges so far",
      supporters: { count: 1234, year: 567890, median: 128 },
    });
    expect(terms(html)).toEqual([
      ["pledged each year", "₹5,67,890"],
      ["supporters", "1,234"],
      ["median monthly pledge", "₹128"],
    ]);
    expect(html).toContain("Live · Updated hourly");
  });

  it("show nothing without figures", async () => {
    expect((await render({ title: "Pledges so far", supporters: null })).trim()).toBe("");
  });
});
