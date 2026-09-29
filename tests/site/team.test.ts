import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";
import { COMMUNITY_TEAM } from "../../src/data/team.ts";

describe("Team page (/team)", () => {
  const html = read("team.html");

  it("renders every team entry", () => {
    expect(html.match(/<article\b/g)).toHaveLength(COMMUNITY_TEAM.length);
  });

  it("requests each GitHub avatar at twice its display width, not at full size", () => {
    const avatars = [
      ...html.matchAll(/<img src="(https:\/\/github\.com\/[^"]+)"[^>]*width="(\d+)"/g),
    ];
    expect(avatars).toHaveLength(COMMUNITY_TEAM.filter((member) => member.photoUrl).length);
    for (const [, src, width] of avatars) {
      expect(new URL(src!).searchParams.get("size"), `${src} sets the wrong size`).toBe(
        String(Number(width) * 2),
      );
    }
  });

  it("invites new members from one card with one mail link", () => {
    const cards = html.match(/<aside\b[\s\S]*?<\/aside>/g);
    expect(cards).toHaveLength(1);
    expect(cards![0]!.match(/href="mailto:/g)).toHaveLength(1);
  });

  it("links to the Foundation team", () => {
    expect(html).toContain('href="https://fossunited.org/team"');
  });

  it("has team metadata and one h1", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('rel="canonical" href="https://rupeefund.org/team"');
  });
});

describe("Team navigation", () => {
  const home = read("index.html");

  it("links to the team page from the footer", () => {
    const footer = home.slice(home.indexOf("<footer"));
    expect(footer).toContain('href="/team"');
  });

  it("links to the team page from desktop and mobile navigation", () => {
    const header = home.slice(home.indexOf("<header"), home.indexOf("</header>"));
    expect(header.match(/href="\/team"/g)).toHaveLength(2);
  });

  it("names the page Team in the title, the heading and every link to it", () => {
    const team = read("team.html");
    expect(team).toMatch(/<title>Team — The Rupee Fund<\/title>/);
    expect(team).toMatch(/<h1[^>]*>Team<\/h1>/);
    expect(home.match(/href="\/team"[^>]*>\s*Team\s*</g)).toHaveLength(3);
  });

  it("marks Team as current in both navigation menus", () => {
    const team = read("team.html");
    const header = team.slice(team.indexOf("<header"), team.indexOf("</header>"));
    expect(header.match(/href="\/team" aria-current="page"/g)).toHaveLength(2);
  });
});
