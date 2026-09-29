import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

describe("Home page (/)", () => {
  const html = read("index.html");

  it("names the fund in its one h1, before the tagline", () => {
    const main = html.split("<main")[1];
    expect(main.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe("The Rupee Fund");
    expect(main.indexOf("<h1")).toBeLessThan(main.indexOf("Keep FOSS in India alive"));
  });

  it("sets the canonical URL", () => {
    expect(html).toContain('rel="canonical" href="https://rupeefund.org"');
  });
});
