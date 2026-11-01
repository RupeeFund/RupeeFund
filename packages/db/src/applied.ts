import { d1Rows } from "./export.ts";

export function unapplied(files: readonly string[], applied: readonly string[]): string[] {
  const done = new Set(applied);
  return files.filter((file) => file.endsWith(".sql") && !done.has(file)).toSorted();
}

export function appliedNames(stdout: string): string[] {
  return d1Rows(stdout).map((row) => String(row.name));
}
