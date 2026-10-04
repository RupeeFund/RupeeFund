import { describe, expect, it } from "vitest";
import { read, styles } from "./dist.ts";

describe("Home page (/)", () => {
  const html = read("index.html");

  it("names the fund in its one h1, before the tagline", () => {
    const main = html.split("<main")[1];
    expect(main.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe("The&nbsp;Rupee&nbsp;Fund");
    expect(main.indexOf("<h1")).toBeLessThan(main.indexOf("data-tagline"));
    expect(/data-tagline[^>]*>\s*([^<]*?)\s*</.exec(main)?.[1]).toBe(
      "Not charity — membership in a commons",
    );
  });

  it("cites a source for the developer figure in the band", () => {
    const band =
      /<h2[^>]*>Lots of us, a little each month, for great projects from India<\/h2>([\s\S]*?)<\/section>/.exec(
        html,
      )?.[1] ?? "";
    expect(band).toMatch(/2(&nbsp;|\u00a0)crore developers/);
    expect(band).toMatch(/<a [^>]*href="https:\/\/github\.blog\/[^"]*octoverse[^"]*"/);
  });

  it("keeps the stressed words of each step in the ink colour", () => {
    expect(styles()).toMatch(/\.step-body strong ?\{[^}]*color:/);
  });

  it("sets the canonical URL", () => {
    expect(html).toContain('rel="canonical" href="https://rupeefund.org"');
  });
});
