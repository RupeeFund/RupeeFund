import { GUARDED_COLLECTIONS } from "./guard.ts";

export type Query = (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

const MEDIA_FIELDS = ["image", "file", "portableText", "repeater", "blocks", "json", "url"];

const LEGAL = "(e.kind = 'legal' OR json_extract(r.data, '$.kind') = 'legal')";

const placeholders = (count: number, from = 1): string =>
  Array.from({ length: count }, (_, i) => `?${i + from}`).join(", ");

const any = async (query: Query, sql: string, params: unknown[]): Promise<boolean> =>
  (await query(sql, params)).length > 0;

async function mediaColumns(
  query: Query,
  only?: readonly string[],
): Promise<Map<string, string[]>> {
  const scope = only
    ? ` AND c.slug IN (${placeholders(only.length, MEDIA_FIELDS.length + 1)})`
    : "";
  const fields = await query(
    `SELECT c.slug AS collection, f.slug AS field FROM _emdash_fields f
     JOIN _emdash_collections c ON c.id = f.collection_id
     WHERE f.type IN (${placeholders(MEDIA_FIELDS.length)})${scope}`,
    [...MEDIA_FIELDS, ...(only ?? [])],
  );
  const byCollection = new Map<string, string[]>();
  for (const row of fields) {
    const collection = String(row.collection);
    const field = String(row.field);
    if (!IDENTIFIER.test(collection) || !IDENTIFIER.test(field)) continue;
    byCollection.set(collection, [...(byCollection.get(collection) ?? []), field]);
  }
  return byCollection;
}

const anyOf = (query: Query, selects: string[], params: unknown[]): Promise<boolean> =>
  any(
    query,
    `SELECT 1 WHERE ${selects.map((select) => `EXISTS (${select})`).join(" OR ")}`,
    params,
  );

const contains = (text: string): string => `(instr(${text}, ?1) > 0 OR instr(${text}, ?2) > 0)`;

const holds = (columns: string[]): string =>
  columns.map((column) => contains(`e."${column}"`)).join(" OR ");

export async function isLegalPage(query: Query, entry: string): Promise<boolean> {
  return any(
    query,
    `SELECT 1 FROM ec_pages e LEFT JOIN revisions r ON r.id = e.draft_revision_id
     WHERE (e.id = ?1 OR e.slug = ?1) AND ${LEGAL} LIMIT 1`,
    [entry],
  );
}

export async function revisionTarget(
  query: Query,
  revision: string,
): Promise<{ collection: string; entry: string; legal: boolean } | null> {
  const [row] = await query(
    `SELECT collection, entry_id, json_extract(data, '$.kind') = 'legal' AS legal
     FROM revisions WHERE id = ?1`,
    [revision],
  );
  if (!row) return null;
  return {
    collection: String(row.collection),
    entry: String(row.entry_id),
    legal: row.legal === 1,
  };
}

export async function isPublishedMedia(query: Query, key: string): Promise<boolean> {
  const [item] = await query("SELECT id FROM media WHERE storage_key = ?1", [key]);
  const byCollection = await mediaColumns(query);
  if (byCollection.size === 0) return false;
  const selects = [...byCollection].map(
    ([collection, columns]) =>
      `SELECT 1 FROM "ec_${collection}" e
       WHERE e.status = 'published' AND e.deleted_at IS NULL AND (${holds(columns)})`,
  );
  return anyOf(query, selects, [key, item ? String(item.id) : key]);
}

export async function usesGuardedMedia(query: Query, media: string): Promise<boolean> {
  const [item] = await query("SELECT storage_key FROM media WHERE id = ?1", [media]);
  if (!item) return false;
  const byCollection = await mediaColumns(query, GUARDED_COLLECTIONS);
  if (byCollection.size === 0) return false;
  const selects = [...byCollection].map(
    ([collection, columns]) =>
      `SELECT 1 FROM "ec_${collection}" e
       LEFT JOIN revisions r ON r.id = e.draft_revision_id
       WHERE (${holds(columns)} OR ${contains("r.data")})
       ${collection === "pages" ? `AND ${LEGAL}` : ""}`,
  );
  return anyOf(query, selects, [String(item.storage_key), media]);
}

const COVERS_GUARDED = `SELECT 1 FROM _emdash_taxonomy_defs d, json_each(d.collections) c
  WHERE d.name = ?1 AND c.value IN (${placeholders(GUARDED_COLLECTIONS.length, 2)})`;

export async function taxonomyCoversGuarded(query: Query, taxonomy: string): Promise<boolean> {
  return any(query, `${COVERS_GUARDED} LIMIT 1`, [taxonomy, ...GUARDED_COLLECTIONS]);
}

export async function termCoversGuarded(query: Query, term: string): Promise<boolean> {
  const [row] = await query("SELECT name FROM taxonomies WHERE id = ?1", [term]);
  return row !== undefined && taxonomyCoversGuarded(query, String(row.name));
}

export async function activeUser(query: Query, id: string): Promise<boolean> {
  return any(query, "SELECT 1 FROM users WHERE id = ?1 AND disabled = 0", [id]);
}
