import { describe, expect, it } from "vitest";
import { read, styles } from "./dist.ts";

describe("Home page (/)", () => {
  const html = read("index.html");

  it("names the fund in its one h1, before the tagline", () => {
    const main = html.split("<main")[1];
    expect(main.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe("The&nbsp;Rupee&nbsp;Fund");
    expect(main.indexOf("<h1")).toBeLessThan(main.indexOf("data-tagline"));
    expect(/data-tagline[^>]*>\s*([^<]*?)\s*</.exec(main)?.[1]).toBe(
      "Lots of us, a little each month, for great projects from India",
    );
  });

  it("cites a source for the developer figure in the band", () => {
    const band =
      /<h2[^>]*>From silicon to software, every project needs support<\/h2>([\s\S]*?)<\/section>/.exec(
        html,
      )?.[1] ?? "";
    expect(band).toMatch(/2(&nbsp;|\u00a0)crore developers/);
    expect(band).toMatch(/<a [^>]*href="https:\/\/github\.blog\/[^"]*octoverse[^"]*"/);
  });

  it("shows the lede, the four steps, the three reasons and the FAQ title", () => {
    const main = html.split("<main")[1] ?? "";
    expect(main).toContain("pools your monthly contributions over UPI");
    expect([...main.matchAll(/class="step-number">(\d)</g)].map((m) => m[1])).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect([...main.matchAll(/class="step-title">([^<]*)</g)].map((m) => m[1])).toEqual([
      "Subscribe",
      "Pool funds",
      "Vote and nominate",
      "Disburse",
    ]);
    expect(main).toMatch(/class="step-body"[^>]*>[\s\S]*?<strong>monthly<\/strong>/);
    for (const reason of [
      "Nurture new projects",
      "Encourage growing projects",
      "Sustain well-established projects",
    ]) {
      expect(main).toContain(`>${reason}</h3>`);
    }
    expect(main).toContain(">Why join us</h2>");
    expect(main).toContain(">Frequently asked questions</h2>");
  });

  it("names who the fund is for, then asks them to sign up", () => {
    const groups = /<h2[^>]*>Who you are<\/h2>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";
    expect([...groups.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1])).toEqual([
      "Students",
      "Users",
      "Contributors",
    ]);
    expect(groups).toContain("Chai++ rates");
    expect(groups).toContain("Hear when the fund opens");
    expect(groups).toContain('href="/subscribe"');
    expect(html.match(/id="signup-title"/g)).toHaveLength(1);
    expect(html.indexOf(">Why join us</h2>")).toBeLessThan(html.indexOf(">Who you are</h2>"));
    expect(html.indexOf(">Who you are</h2>")).toBeLessThan(
      html.indexOf(">Frequently asked questions</h2>"),
    );
  });

  it("keeps the stressed words of each step in the ink colour", () => {
    expect(styles()).toMatch(/\.step-body strong ?\{[^}]*color:/);
  });

  it("sets the canonical URL", () => {
    expect(html).toContain('rel="canonical" href="https://rupeefund.org"');
  });

  it("dates the copyright line with the current year", () => {
    const year = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" });
    expect(html).toContain(`© ${year.format()} The`);
  });
});
