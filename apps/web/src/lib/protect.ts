import { deletedEntry, LEGAL_COLLECTION, writeTarget } from "./guard.ts";
import {
  isLegalPage,
  isPublishedMedia,
  revisionTarget,
  taxonomyCoversGuarded,
  termCoversGuarded,
  usesGuardedMedia,
  type Query,
} from "./guard-store.ts";

export const SESSION_TIMEOUT_MS = 3_000;

interface Session {
  get(key: "user"): Promise<unknown>;
}

async function refusesEntry(
  query: Query,
  collection: string,
  entry: string | null,
): Promise<boolean> {
  if (collection !== LEGAL_COLLECTION || entry === null) return false;
  return isLegalPage(query, entry);
}

export async function refusesWrite(
  query: Query,
  method: string,
  path: string,
  termOf: () => Promise<string | null>,
): Promise<boolean> {
  const target = writeTarget(method, path);
  if (target === null) return false;
  switch (target.kind) {
    case "entry":
      return refusesEntry(query, target.collection, target.entry);
    case "revision": {
      const owner = await revisionTarget(query, target.revision);
      if (owner === null) return false;
      if (owner.collection === LEGAL_COLLECTION && owner.legal) return true;
      return refusesEntry(query, owner.collection, owner.entry);
    }
    case "media":
      return usesGuardedMedia(query, target.media);
    case "taxonomy":
      return taxonomyCoversGuarded(query, target.taxonomy);
    case "terms": {
      const term = await termOf();
      return term !== null && (await termCoversGuarded(query, term));
    }
  }
}

export async function deletesLegalPage(
  query: Query,
  method: string,
  path: string,
): Promise<boolean> {
  const target = deletedEntry(method, path);
  return target !== null && refusesEntry(query, target.collection, target.entry);
}

export async function isPublic(
  query: Query,
  key: string,
  stored: (key: string) => Promise<boolean>,
): Promise<boolean> {
  try {
    return (await stored(key)) && (await isPublishedMedia(query, key));
  } catch {
    return false;
  }
}

export async function sessionUserId(
  session: Session | undefined,
  keepAlive: (pending: Promise<unknown>) => void,
  timeoutMs = SESSION_TIMEOUT_MS,
): Promise<string | null> {
  if (!session) return null;
  const read = Promise.resolve(session.get("user")).catch(() => undefined);
  keepAlive(read);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((done) => {
    timer = setTimeout(done, timeoutMs, undefined);
  });
  try {
    const user = await Promise.race([read, timeout]);
    const id = (user as { id?: unknown } | undefined)?.id;
    return typeof id === "string" && id !== "" ? id : null;
  } finally {
    clearTimeout(timer);
  }
}
