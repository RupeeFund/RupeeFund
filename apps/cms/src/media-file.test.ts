import { describe, expect, it } from "vitest";
import { mediaFile } from "./media-file.ts";

describe("a media file answer", () => {
  it("serves a raster image with its type and a sandbox policy", () => {
    const res = mediaFile("01ABC.png", "x", "no-store");
    expect(res?.headers.get("content-type")).toBe("image/png");
    expect(res?.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(res?.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["01ABC.svg", "01ABC.html", "backups/site.json", "../x.png", "a/b.png"])(
    "refuses %s, which can carry a script or leaves the media library",
    (key) => expect(mediaFile(key, "x", "no-store")).toBeNull(),
  );
});
