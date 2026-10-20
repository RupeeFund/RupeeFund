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

  it("gives the developer figure and the monthly pool in the band", () => {
    const band =
      /<h2[^>]*>From silicon to software, every project needs support<\/h2>([\s\S]*?)<\/section>/.exec(
        html,
      )?.[1] ?? "";
    expect(band).toMatch(/Nearly 3(&nbsp;|\u00a0)crore developers/);
    expect(band).toMatch(/more than ₹40(&nbsp;|\u00a0)lakh every month/);
    expect(band).not.toMatch(/<a /);
  });

  it("shows the live supporter figures from the list", () => {
    const band = html.slice(html.indexOf("Live · Updated hourly"));
    expect([...band.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map((m) => m[1]?.trim())).toEqual([
      "26",
      "₹1,24,185",
      "₹1,308",
    ]);
  });

  it("asks the visitor to sign up from the pledges", () => {
    const pledges = /<h2[^>]*>Pledges so far<\/h2>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";
    expect(pledges).toMatch(/<a href="\/subscribe" class="btn btn-primary btn-xl"/);
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
      "Sustain well\u2011established projects",
    ]) {
      expect(main).toContain(`>${reason}</h3>`);
    }
    expect(main).toContain(">Why join us</h2>");
    expect(main).toContain(">Frequently asked questions</h2>");
  });

  it("names who the fund is for, shows the pledges, then asks them to sign up", () => {
    const groups = /<h2[^>]*>Join if you are<\/h2>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";
    expect([...groups.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1])).toEqual([
      "Student",
      "User",
      "Contributor",
    ]);
    expect(groups).toContain("₹15 a month, the price of a cup of chai");
    expect(html).not.toContain('id="signup-title"');
    const order = [
      ">Why join us</h2>",
      ">Join if you are</h2>",
      ">Pledges so far</h2>",
      ">Frequently asked questions</h2>",
    ].map((mark) => html.indexOf(mark));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
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
