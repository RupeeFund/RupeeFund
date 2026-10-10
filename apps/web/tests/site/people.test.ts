import { describe, expect, it } from "vitest";
import { headerOf, read } from "./dist.ts";
import { PEOPLE } from "../fixtures/content.ts";

describe("People page (/people)", () => {
  const html = read("people.html");

  it("renders every team entry", () => {
    expect(html.match(/<article\b/g)).toHaveLength(PEOPLE.length);
  });

  it("requests each GitHub avatar at twice its display width, not at full size", () => {
    const avatars = [
      ...html.matchAll(/<img src="(https:\/\/github\.com\/[^"]+)"[^>]*width="(\d+)"/g),
    ];
    expect(avatars).toHaveLength(PEOPLE.filter((member) => member.photoUrl).length);
    for (const [, src, width] of avatars) {
      expect(new URL(src!).searchParams.get("size"), `${src} sets the wrong size`).toBe(
        String(Number(width) * 2),
      );
    }
  });

  it("invites new members with a mail link", () => {
    expect(html).toMatch(/href="mailto:[^"]*subject=Joining/);
  });

  it("links to the Foundation team in a new tab", () => {
    expect(html).toMatch(
      /<a href="https:\/\/fossunited\.org\/team" target="_blank" rel="noopener noreferrer" class="inline-link">FOSS United team<\/a>/,
    );
  });

  it("shows the team, join and Foundation words", () => {
    for (const words of [
      ">Community team</h2>",
      "Meet the volunteers from the FOSS United community who run",
      ">You, or someone you know?</h3>",
      "Bring ideas, skills, and a little time to the community team",
      ">FOSS United Foundation</h2>",
      "is the fiscal host of",
    ]) {
      expect(html).toContain(words);
    }
  });

  it("names the page People in its title and heading, at its canonical URL", () => {
    expect(html).toMatch(/<title>People — The Rupee Fund<\/title>/);
    expect(html).toMatch(/<h1[^>]*>People<\/h1>/);
    expect(html).toContain('rel="canonical" href="https://rupeefund.org/people"');
  });
});

describe("People navigation", () => {
  const home = read("index.html");

  it("links to People from the header and the footer, and to no Home link", () => {
    const links = [...home.matchAll(/<a [^>]*href="([^"]+)"[^>]*>\s*([^<]+?)\s*</g)].map(
      ([, href, text]) => `${href} ${text}`,
    );
    expect(links.filter((l) => l === "/people People").length).toBeGreaterThanOrEqual(2);
    expect(links).not.toContain("/ Home");
  });

  it("marks People as the current page in both header menus", () => {
    expect(headerOf("people.html").match(/href="\/people" aria-current="page"/g)).toHaveLength(2);
  });
});
