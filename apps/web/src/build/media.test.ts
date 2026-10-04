import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentSource, readContent } from "./content.ts";
import { copyMedia } from "./media.ts";

const fixture = () =>
  readContent(contentSource({ CMS_CONTENT_FILE: "tests/fixtures/content/published.json" }));

describe("copying the media into the build", () => {
  it("writes each file the content uses under /media", async () => {
    const out = mkdtempSync(join(tmpdir(), "media-"));
    const copied = await copyMedia(await fixture(), out);
    expect(copied.toSorted()).toEqual([
      "01M40TESTINLINE00000000000.png",
      "01M40TESTLEAD0000000000000.png",
      "01M40TESTPANORAMA00000000.webp",
      "01M40TESTPORTRAIT000000000.jpg",
      "01M40TESTSMALL00000000000.png",
    ]);
    expect(
      readFileSync(join(out, "media", "01M40TESTLEAD0000000000000.png"))
        .subarray(1, 4)
        .toString(),
    ).toBe("PNG");
  });

  it("fails the build when a file is missing", async () => {
    const loaded = await fixture();
    const missing = { ...loaded, mediaUrl: () => new URL("https://cms.example/media/gone.png") };
    const fetcher = async () => new Response("", { status: 404 });
    await expect(
      copyMedia(missing, mkdtempSync(join(tmpdir(), "media-")), fetcher),
    ).rejects.toThrow(/404/);
  });

  it("waits and tries again when the cms limits the rate", async () => {
    const loaded = await fixture();
    const remote = { ...loaded, mediaUrl: () => new URL("https://cms.example/media/a.png") };
    let limited = true;
    const answer = async () => {
      if (!limited) return new Response("PNG");
      limited = false;
      return new Response("", { status: 429 });
    };
    const waits: number[] = [];
    const copied = await copyMedia(
      remote,
      mkdtempSync(join(tmpdir(), "media-")),
      answer,
      async (ms) => void waits.push(ms),
    );
    expect([copied.length, waits]).toEqual([5, [60_000]]);
  });
});
