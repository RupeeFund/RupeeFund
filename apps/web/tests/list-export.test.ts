import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseD1Json } from "../scripts/list-export.mts";

describe("the wrangler --json envelope is unwrapped as wrangler actually emits it", () => {
  it("reads results out of the array wrangler returns", () => {
    const stdout = JSON.stringify([
      { results: [{ id: 13 }], success: true, meta: { duration: 0 } },
    ]);
    expect(parseD1Json(stdout)).toEqual([{ id: 13 }]);
  });

  it("tolerates a bare object instead of an array", () => {
    expect(parseD1Json(JSON.stringify({ results: [{ id: 1 }] }))).toEqual([{ id: 1 }]);
  });

  it("returns nothing rather than throwing when the envelope has no results", () => {
    expect(parseD1Json(JSON.stringify([{ success: true }]))).toEqual([]);
  });
});

describe.skipIf(process.platform === "win32")("the export entry point", () => {
  it("runs when its path differs from the real file", () => {
    const dir = mkdtempSync(join(tmpdir(), "rf export "));
    try {
      writeFileSync(join(dir, "pnpm"), "#!/bin/sh\necho '[{\"results\":[]}]'\n");
      chmodSync(join(dir, "pnpm"), 0o755);
      symlinkSync(resolve("scripts/list-export.mts"), join(dir, "list-export.mts"));
      const run = spawnSync(process.execPath, [join(dir, "list-export.mts"), "--dry-run"], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` },
        timeout: 10_000,
      });
      expect(run.stderr).toContain("0 row(s) would be stamped");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
