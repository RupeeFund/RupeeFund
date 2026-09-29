import { spawnSync } from "node:child_process";

export const TEST_SITEKEY = "1x00000000000000000000AA";

export const DUMMY_SITEKEYS = [
  TEST_SITEKEY,
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
] as const;

export interface Result {
  code: number;
  stderr: string;
}

export function runNode(
  script: string,
  options: { cwd?: string; env?: Record<string, string> } = {},
): Result {
  const out = spawnSync(process.execPath, [script], { ...options, encoding: "utf8" });
  return { code: out.status ?? -1, stderr: out.stderr };
}
