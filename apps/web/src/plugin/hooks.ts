import {
  ContentSaveRejectedError,
  type ContentDeleteEvent,
  type ContentHookEvent,
  type ContentPolicyDecision,
  type ContentPolicyEvent,
} from "emdash";

const ADMIN_ROLE = 50;

export interface Store {
  get(
    collection: string,
    id: string,
  ): Promise<{ data: Record<string, unknown>; draft?: Record<string, unknown> } | null>;
  count(collection: string): Promise<number>;
}

type Actor = ContentHookEvent["actor"];

const isAdmin = (actor: Actor): boolean => (actor?.role ?? 0) >= ADMIN_ROLE;

const isLegal = (data: unknown): boolean =>
  typeof data === "object" && data !== null && (data as { kind?: unknown }).kind === "legal";

async function storedIsLegal(store: Store, id: unknown): Promise<boolean> {
  if (typeof id !== "string") return true;
  try {
    const entry = await store.get("pages", id);
    return entry === null || isLegal(entry.data) || isLegal(entry.draft);
  } catch {
    return true;
  }
}

async function landingCount(store: Store): Promise<number> {
  try {
    return await store.count("landing");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export async function saveGate(
  event: Pick<ContentHookEvent, "collection" | "content" | "isNew" | "id" | "actor">,
  store: Store,
): Promise<void> {
  if (event.collection === "landing") {
    if (!isAdmin(event.actor))
      throw new ContentSaveRejectedError(
        "Only an admin can edit the landing page. Ask an admin for the change.",
      );
    if (event.isNew && (await landingCount(store)) > 0) {
      throw new ContentSaveRejectedError("The landing page has one entry. Edit that entry.");
    }
    return;
  }
  if (isAdmin(event.actor)) return;
  const legal =
    event.collection === "pages" &&
    (isLegal(event.content) || (!event.isNew && (await storedIsLegal(store, event.id))));
  if (legal)
    throw new ContentSaveRejectedError(
      "Only an admin can edit a legal page. Ask an admin for the change.",
    );
}

export async function publishGate(
  event: Pick<ContentPolicyEvent, "collection" | "content" | "origin" | "actor">,
  store: Store,
): Promise<ContentPolicyDecision> {
  if (event.collection === "landing" && isAdmin(event.actor) && (await landingCount(store)) > 1) {
    return { cancel: true, reason: "The landing page has one entry. Delete the copy first." };
  }
  if (isAdmin(event.actor)) return;
  const guarded =
    event.collection === "landing" ||
    (event.collection === "pages" &&
      (isLegal(event.content.data) || (await storedIsLegal(store, event.content.id))));
  if (!guarded) return;
  return {
    cancel: true,
    reason: "Only an admin can publish or unpublish this entry. Ask an admin for the change.",
  };
}

export async function deleteGate(
  event: Pick<ContentDeleteEvent, "collection" | "id">,
  store: Store,
): Promise<false | undefined> {
  if (event.collection === "landing") {
    const landings = await landingCount(store);
    return Number.isFinite(landings) && landings > 1 ? undefined : false;
  }
  if (event.collection === "pages" && (await storedIsLegal(store, event.id))) return false;
  return undefined;
}

export function scheduleGate(): ContentPolicyDecision {
  return {
    cancel: true,
    reason: "The content manager does not publish at a set time. Publish the entry now.",
  };
}
