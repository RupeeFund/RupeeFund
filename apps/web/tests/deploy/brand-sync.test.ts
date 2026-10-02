import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SHARED,
  assertSiteColors,
  brandDir,
  colorsFromTokens,
  themeCss,
  withManifestColors,
} from "../../scripts/brand-sync.mts";

const tokens = {
  color: {
    $type: "color",
    brand: { $value: { colorSpace: "srgb", components: [0.03, 0.72, 0.31], hex: "#08B74F" } },
    "brand-fg": { $value: { colorSpace: "srgb", components: [0.02, 0.48, 0.2], hex: "#057a33" } },
    paper: { $value: { colorSpace: "srgb", components: [0.94, 0.94, 0.94], hex: "#f0f0f0" } },
  },
};

describe("brand sync", () => {
  it("reads every colour token as lower-case hex and skips the group metadata", () => {
    expect(colorsFromTokens(tokens)).toEqual({
      brand: "#08b74f",
      "brand-fg": "#057a33",
      paper: "#f0f0f0",
    });
  });

  it("writes the colours as a Tailwind theme block", () => {
    expect(themeCss({ brand: "#08b74f", paper: "#f0f0f0" })).toBe(
      "@theme {\n  --color-brand: #08b74f;\n  --color-paper: #f0f0f0;\n}\n",
    );
  });

  it("sets the manifest theme and background colours and leaves the rest of the file alone", () => {
    const manifest = `{
  "name": "The Rupee Fund",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
`;
    expect(withManifestColors(manifest, { "brand-fg": "#057a33", paper: "#f0f0f0" })).toBe(
      manifest.replace('"#ffffff"', '"#f0f0f0"').replace('"#000000"', '"#057a33"'),
    );
  });

  it("refuses a manifest that has lost a colour key, so the site cannot keep a stale value", () => {
    expect(() =>
      withManifestColors(`{ "name": "x" }`, { "brand-fg": "#057a33", paper: "#f0f0f0" }),
    ).toThrow(/theme_color/);
  });

  it("refuses tokens that lost a colour the site uses, so a pin bump cannot drop a variable", () => {
    expect(() => assertSiteColors({ brand: "#08b74f" })).toThrow(/brand-fg/);
  });
});

describe("the brand checkout", () => {
  it("reads a relative BRAND_DIR from where the operator ran pnpm", () => {
    expect(brandDir({ BRAND_DIR: "../brand", INIT_CWD: "/repo" }, "/repo/apps/web")).toBe("/brand");
  });

  it("keeps an absolute BRAND_DIR as it is", () => {
    expect(brandDir({ BRAND_DIR: "/src/brand", INIT_CWD: "/repo" }, "/repo/apps/web")).toBe(
      "/src/brand",
    );
  });

  it("fetches from the brand site when BRAND_DIR is not set", () => {
    expect(brandDir({}, "/repo/apps/web")).toBeUndefined();
  });
});

describe("the shared brand files", () => {
  it.each(SHARED)(
    "serves %s at its public address, the same bytes the ui package holds",
    (name) => {
      expect(readFileSync(`public/${name}`)).toEqual(readFileSync(`../../packages/ui/src/${name}`));
    },
  );
});
