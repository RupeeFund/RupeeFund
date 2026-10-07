export function unapplied(files: readonly string[], applied: readonly string[]): string[] {
  const done = new Set(applied);
  return files.filter((file) => file.endsWith(".sql") && !done.has(file)).toSorted();
}

export function appliedNames(stdout: string): string[] {
  const parsed: unknown = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const rows: unknown = (first as { results?: unknown } | undefined)?.results;
  if (!Array.isArray(rows)) throw new Error("wrangler returned no rows for d1_migrations");
  return rows.map((row) => String((row as { name?: unknown }).name));
}
