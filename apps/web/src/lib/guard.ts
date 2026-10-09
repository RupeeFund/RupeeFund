export type WriteTarget =
  | { kind: "entry"; collection: string; entry: string | null }
  | { kind: "revision"; revision: string }
  | { kind: "media"; media: string }
  | { kind: "terms" }
  | { kind: "taxonomy"; taxonomy: string };

export const GUARDED_COLLECTIONS = ["pages"] as const;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const GUARDED = new Set<string>(GUARDED_COLLECTIONS);

const SCHEMA_TREES = [
  "/_emdash/api/schema",
  "/_emdash/api/relations",
  "/_emdash/api/admin/byline-fields",
];

const TAXONOMY_DEFINITION = /^\/_emdash\/api\/taxonomies(?:\/(?!bulk-tag$)[^/]+)?$/;

const CONTENT = /^\/_emdash\/api\/(?:visual-editing\/)?content\/([^/]+)(?:\/([^/]+))?(?:\/.*)?$/;

const REVISION_RESTORE = /^\/_emdash\/api\/revisions\/([^/]+)\/restore$/;

const MEDIA_ITEM = /^\/_emdash\/api\/media\/([^/]+)$/;

const MEDIA_REPLACE = /^\/_emdash\/api\/media\/([^/]+)\/replace$/;

const PROVIDER_ITEM = /^\/_emdash\/api\/media\/providers\/[^/]+\/([^/]+)$/;

const TERMS_OF = /^\/_emdash\/api\/taxonomies\/([^/]+)\/(?!terms$).+$/;

const BULK_TAG = "/_emdash/api/taxonomies/bulk-tag";

const MEDIA_FILE = /^\/(?:media|_emdash\/api\/media\/file)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;

const isUnsafe = (method: string): boolean => !SAFE_METHODS.has(method.toUpperCase());

const within = (path: string, tree: string): boolean =>
  path === tree || path.startsWith(`${tree}/`);

export function locksSchema(method: string, path: string, token: boolean): boolean {
  if (token || !isUnsafe(method)) return false;
  return SCHEMA_TREES.some((tree) => within(path, tree)) || TAXONOMY_DEFINITION.test(path);
}

function mediaTarget(method: string, path: string): WriteTarget | null {
  const verb = method.toUpperCase();
  const replaced = verb === "PUT" ? MEDIA_REPLACE.exec(path)?.[1] : undefined;
  const deleted =
    verb === "DELETE" ? (MEDIA_ITEM.exec(path) ?? PROVIDER_ITEM.exec(path))?.[1] : undefined;
  const media = replaced ?? deleted;
  return media && media !== "file" ? { kind: "media", media } : null;
}

export function writeTarget(method: string, path: string): WriteTarget | null {
  if (!isUnsafe(method)) return null;
  if (path === BULK_TAG) return { kind: "terms" };
  const revision = REVISION_RESTORE.exec(path)?.[1];
  if (revision) return { kind: "revision", revision };
  const media = mediaTarget(method, path);
  if (media) return media;
  const taxonomy = TERMS_OF.exec(path)?.[1];
  if (taxonomy) return { kind: "taxonomy", taxonomy };
  const content = CONTENT.exec(path);
  const collection = content?.[1];
  if (!collection || !GUARDED.has(collection)) return null;
  return { kind: "entry", collection, entry: content[2] ?? null };
}

export const mediaKey = (path: string): string | null => MEDIA_FILE.exec(path)?.[1] ?? null;

export const isMediaFile = (path: string): boolean =>
  within(path, "/media") || within(path, "/_emdash/api/media/file");

export const isMediaAsset = (path: string): boolean => path.startsWith("/_emdash/api/media/asset/");
