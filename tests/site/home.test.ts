import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

describe("Home page (/)", () => {
  it("names the fund in its one h1, before the tagline", () => {
    const main = read("index.html").split("<main")[1];
    expect(main.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe("The Rupee Fund");
    expect(main.indexOf("<h1")).toBeLessThan(main.indexOf("Keep FOSS in India alive"));
  });

  it("leaves the logo to the header", () => {
    expect(read("index.html").split("<main")[1]).not.toContain('id="wordmark"');
  });
});
