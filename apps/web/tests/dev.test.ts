import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STAGE, contentWatcher, syncDir } from "../scripts/dev.mts";

let root: string;
let from: string;
let to: string;

function put(dir: string, path: string, text: string): void {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), text);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rupeefund-sync-"));
  from = join(root, "from");
  to = join(root, "to");
  mkdirSync(from);
  mkdirSync(to);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("syncDir copies a fresh build into the served folder", () => {
  it("adds a new file in a new folder", () => {
    put(from, "_astro/a.css", "a");
    expect(syncDir(from, to)).toEqual(["_astro/a.css"]);
    expect(readFileSync(join(to, "_astro/a.css"), "utf8")).toBe("a");
  });

  it("rewrites a changed file in place, so the file watcher of wrangler sees a change", () => {
    put(to, "index.html", "old");
    put(from, "index.html", "new");
    const inode = statSync(join(to, "index.html")).ino;
    expect(syncDir(from, to)).toEqual(["index.html"]);
    expect(readFileSync(join(to, "index.html"), "utf8")).toBe("new");
    expect(statSync(join(to, "index.html")).ino).toBe(inode);
  });

  it("leaves an unchanged file alone", () => {
    put(to, "same.html", "x");
    put(from, "same.html", "x");
    expect(syncDir(from, to)).toEqual([]);
  });

  it("removes a file and a folder that the build no longer makes", () => {
    put(to, "gone/page.html", "x");
    put(to, "stale.html", "x");
    expect(syncDir(from, to).sort()).toEqual(["gone/page.html", "stale.html"]);
    expect(existsSync(join(to, "gone"))).toBe(false);
    expect(existsSync(join(to, "stale.html"))).toBe(false);
  });

  it("replaces a folder with a file of the same name", () => {
    put(to, "page/index.html", "x");
    put(from, "page", "y");
    syncDir(from, to);
    expect(readFileSync(join(to, "page"), "utf8")).toBe("y");
  });
});

it("stages the build inside the app, because Astro moves its files there with rename()", () => {
  expect(relative(process.cwd(), resolve(STAGE)).startsWith("..")).toBe(false);
});

describe("the content watcher", () => {
  it("rebuilds when the cms content changes, and not before", async () => {
    const bodies = ["a", "a", "b", "b"];
    let rebuilds = 0;
    const tick = contentWatcher(
      "http://localhost:8790/published.json",
      async () => new Response(bodies.shift()),
      () => rebuilds++,
    );
    for (let i = 0; i < 4; i++) await tick();
    expect(rebuilds).toBe(1);
  });

  it("keeps the last content when the cms does not answer", async () => {
    const answers = [() => new Response("a"), () => Promise.reject(new Error("down"))];
    let rebuilds = 0;
    const tick = contentWatcher(
      "http://x/published.json",
      async () => answers.shift()!(),
      () => rebuilds++,
    );
    await tick();
    await tick();
    expect(rebuilds).toBe(0);
  });
});
