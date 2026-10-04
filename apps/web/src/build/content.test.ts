import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CMS_CONTENT_URL,
  contentSource,
  newestFirst,
  readContent,
  sharedContent,
} from "./content.ts";

const FIXTURE = "tests/fixtures/content/published.json";
const fixtureText = readFileSync(FIXTURE, "utf8");

const ok = (body: string) => async () => new Response(body, { status: 200 });

describe("the content source", () => {
  it("reads the live cms when nothing overrides it", () => {
    expect(contentSource({})).toEqual({ kind: "url", url: CMS_CONTENT_URL });
    expect(CMS_CONTENT_URL).toBe("https://cms.rupeefund.org/published.json");
  });

  it("reads a local file for dev and tests", () => {
    expect(contentSource({ CMS_CONTENT_FILE: FIXTURE })).toEqual({ kind: "file", path: FIXTURE });
  });

  it("prefers an explicit URL over the file, so a local cms can stand in", () => {
    expect(
      contentSource({
        CMS_CONTENT_FILE: FIXTURE,
        CMS_CONTENT_URL: "http://localhost:8790/published.json",
      }),
    ).toEqual({ kind: "url", url: "http://localhost:8790/published.json" });
  });
});

describe("reading the content", () => {
  it("parses a document that the schema accepts", async () => {
    const { content } = await readContent({ kind: "url", url: CMS_CONTENT_URL }, ok(fixtureText));
    expect(content.faq.length).toBeGreaterThan(0);
  });

  it("fails when the cms does not answer 200, so the build stops", async () => {
    const fetcher = async () => new Response("down", { status: 503 });
    await expect(readContent({ kind: "url", url: CMS_CONTENT_URL }, fetcher)).rejects.toThrow(
      /503/,
    );
  });

  it("waits and tries again when the cms limits the rate", async () => {
    const replies = [new Response("", { status: 429, headers: { "retry-after": "2" } })];
    const fetcher = async () => replies.shift() ?? new Response(fixtureText);
    const waits: number[] = [];
    const loaded = await readContent({ kind: "url", url: CMS_CONTENT_URL }, fetcher, async (ms) => {
      waits.push(ms);
    });
    expect([loaded.content.version, waits]).toEqual([1, [2_000]]);
  });

  it("reads the cms once for the pages and the media", async () => {
    let reads = 0;
    const fetcher = async () => {
      reads++;
      return new Response(fixtureText);
    };
    const source = { kind: "url", url: "https://cms.example/once.json" } as const;
    await Promise.all([sharedContent(source, fetcher), sharedContent(source, fetcher)]);
    expect(reads).toBe(1);
  });

  it("fails when the cms cannot be reached", async () => {
    const fetcher = async () => Promise.reject(new TypeError("fetch failed"));
    await expect(readContent({ kind: "url", url: CMS_CONTENT_URL }, fetcher)).rejects.toThrow(
      /cms\.rupeefund\.org/,
    );
  });

  it("fails when the document breaks the schema", async () => {
    const broken = JSON.stringify({ ...JSON.parse(fixtureText), faq: [] });
    await expect(readContent({ kind: "url", url: CMS_CONTENT_URL }, ok(broken))).rejects.toThrow(
      /breaks the schema/,
    );
  });

  it("finds each media file beside the document", async () => {
    const { mediaUrl } = await readContent({ kind: "file", path: FIXTURE });
    expect(mediaUrl("01ABC.png").pathname).toMatch(/tests\/fixtures\/content\/media\/01ABC\.png$/);
    const live = await readContent({ kind: "url", url: CMS_CONTENT_URL }, ok(fixtureText));
    expect(live.mediaUrl("01ABC.png").href).toBe("https://cms.rupeefund.org/media/01ABC.png");
  });
});

describe("the post order", () => {
  it("puts the newest post first", () => {
    const posts = [
      { publishedAt: "2026-01-02T00:00:00.000Z" },
      { publishedAt: "2026-03-01T00:00:00.000Z" },
    ];
    expect(newestFirst(posts).map((p) => p.publishedAt)).toEqual([
      "2026-03-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
    ]);
  });
});
