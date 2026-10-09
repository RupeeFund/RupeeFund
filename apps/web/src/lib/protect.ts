import { writeTarget } from "./guard.ts";
import {
  isLegalPage,
  isPublishedMedia,
  revisionTarget,
  taxonomyCoversGuarded,
  termCoversGuarded,
  usesGuardedMedia,
  type Query,
} from "./guard-store.ts";

export const ADMIN_ROLE = 50;

export const SESSION_TIMEOUT_MS = 3_000;

interface Session {
  get(key: "user"): Promise<unknown>;
}

async function refusesEntry(
  query: Query,
  collection: string,
  entry: string | null,
): Promise<boolean> {
  if (collection !== "pages" || entry === null) return false;
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
  try {
    switch (target.kind) {
      case "entry":
        return await refusesEntry(query, target.collection, target.entry);
      case "revision": {
        const owner = await revisionTarget(query, target.revision);
        if (owner === null) return false;
        if (owner.collection === "pages" && owner.legal) return true;
        return await refusesEntry(query, owner.collection, owner.entry);
      }
      case "media":
        return await usesGuardedMedia(query, target.media);
      case "taxonomy":
        return await taxonomyCoversGuarded(query, target.taxonomy);
      case "terms": {
        const term = await termOf();
        return term !== null && (await termCoversGuarded(query, term));
      }
    }
  } catch {
    return true;
  }
}

export async function isPublic(query: Query, key: string): Promise<boolean> {
  try {
    return await isPublishedMedia(query, key);
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
