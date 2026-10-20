import {
  ContentSaveRejectedError,
  type ContentDeleteEvent,
  type ContentHookEvent,
  type ContentPolicyDecision,
  type ContentPolicyEvent,
} from "emdash";
import { ADMIN_ROLE, isAdminCollection, LEGAL_COLLECTION } from "../lib/guard.ts";

export interface Store {
  get(
    collection: string,
    id: string,
  ): Promise<{ data: Record<string, unknown>; draft?: Record<string, unknown> } | null>;
}

type Actor = ContentHookEvent["actor"];

const isAdmin = (actor: Actor): boolean => (actor?.role ?? 0) >= ADMIN_ROLE;

const isLegal = (data: unknown): boolean =>
  typeof data === "object" && data !== null && (data as { kind?: unknown }).kind === "legal";

async function storedIsLegal(store: Store, id: unknown): Promise<boolean> {
  if (typeof id !== "string") return true;
  try {
    const entry = await store.get(LEGAL_COLLECTION, id);
    return entry === null || isLegal(entry.data) || isLegal(entry.draft);
  } catch {
    return true;
  }
}

export async function saveGate(
  event: Pick<ContentHookEvent, "collection" | "content" | "isNew" | "id" | "actor">,
  store: Store,
): Promise<void> {
  if (isAdmin(event.actor)) return;
  if (isAdminCollection(event.collection))
    throw new ContentSaveRejectedError(
      "Only an admin can change this. Ask an admin for the change.",
    );
  const legal =
    event.collection === LEGAL_COLLECTION &&
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
  if (isAdmin(event.actor)) return;
  const guarded =
    isAdminCollection(event.collection) ||
    (event.collection === LEGAL_COLLECTION &&
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
  if (event.collection === LEGAL_COLLECTION && (await storedIsLegal(store, event.id))) return false;
  return undefined;
}

export function scheduleGate(): ContentPolicyDecision {
  return {
    cancel: true,
    reason: "The content manager does not publish at a set time. Publish the entry now.",
  };
}
