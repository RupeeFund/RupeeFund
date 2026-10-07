import {
  ContentSaveRejectedError,
  type ContentDeleteEvent,
  type ContentHookEvent,
  type ContentPolicyDecision,
  type ContentPolicyEvent,
} from "emdash";

const ADMIN_ROLE = 50;

export function policyGate(
  event: Pick<ContentPolicyEvent, "collection" | "origin" | "actor">,
): ContentPolicyDecision {
  if (event.collection !== "policies") return;
  if (event.origin.source === "scheduler") return;
  if ((event.actor?.role ?? 0) >= ADMIN_ROLE) return;
  return { cancel: true, reason: "Only an admin can publish, schedule or unpublish a policy." };
}

export function scheduleGate(): ContentPolicyDecision {
  return {
    cancel: true,
    reason: "The content manager does not publish at a set time. Publish the entry now.",
  };
}

export function policyEditGate(event: Pick<ContentHookEvent, "collection" | "actor">): void {
  if (event.collection !== "policies") return;
  if ((event.actor?.role ?? 0) >= ADMIN_ROLE) return;
  throw new ContentSaveRejectedError("Only an admin can edit a policy.");
}

export function policyDeleteGate(event: Pick<ContentDeleteEvent, "collection">): false | undefined {
  return event.collection === "policies" ? false : undefined;
}

export async function rebuildSite(
  hookUrl: string | undefined,
  fetcher: typeof fetch,
): Promise<"sent" | "skipped"> {
  if (!hookUrl) return "skipped";
  const res = await fetcher(hookUrl, { method: "POST" });
  if (!res.ok) throw new Error(`The deploy hook answered ${res.status}`);
  return "sent";
}
