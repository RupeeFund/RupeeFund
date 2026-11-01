import { describe, expect, it } from "vitest";
import { mediaFile, mediaSrcset, mediaWidth } from "./media.ts";

describe("a media file answer", () => {
  it("serves a raster image with its type and a sandbox policy", () => {
    const res = mediaFile("01ABC.png", "x", "no-store");
    expect(res?.headers.get("content-type")).toBe("image/png");
    expect(res?.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(res?.headers.get("cache-control")).toBe("no-store");
  });

  it("tells the browser not to guess another type", () => {
    expect(mediaFile("01ABC.png", "x", "no-store")?.headers.get("x-content-type-options")).toBe(
      "nosniff",
    );
  });

  it.each(["01ABC.svg", "01ABC.html", "backups/site.json", "../x.png", "a/b.png"])(
    "refuses %s, which can carry a script or leaves the media library",
    (key) => expect(mediaFile(key, "x", "no-store")).toBeNull(),
  );

  it("sends a resized file with the type of the new format", () => {
    expect(mediaFile("01ABC.jpg", "x", "no-store", "image/webp")?.headers.get("content-type")).toBe(
      "image/webp",
    );
  });
});

describe("a resized media file", () => {
  it.each([
    ["320", 320],
    ["100", null],
    ["1200", null],
    ["abc", null],
    [" 320", null],
    ["0x140", null],
    ["3.2e2", null],
    ["320.0", null],
    [null, null],
  ])("takes the width %s as %s, so the number of sizes stays small", (value, width) =>
    expect(mediaWidth(value)).toBe(width),
  );

  it("offers each smaller width and the original", () => {
    expect(mediaSrcset("/media/01ABC.jpg", 500)).toBe(
      "/media/01ABC.jpg?w=160 160w, /media/01ABC.jpg?w=320 320w, /media/01ABC.jpg 500w",
    );
    expect(mediaSrcset("/media/01ABC.jpg", 100)).toBeUndefined();
    expect(mediaSrcset("/media/01ABC.jpg", undefined)).toBeUndefined();
  });
});
