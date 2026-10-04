import type { Content } from "@rupeefund/content/schema";
import { buildDocument, type Collections, type Entry } from "./published.ts";

const SINGLE = new Set<keyof Collections>(["home", "people_page"]);

function withDraft(entries: Entry[], draft: Entry): Entry[] {
  const index = entries.findIndex((entry) => entry.data.id === draft.data.id);
  if (index === -1) return [...entries, draft];
  return entries.with(index, draft);
}

export function previewDocument(
  collections: Collections,
  collection: keyof Collections,
  draft: Entry,
): Content {
  const dated: Entry = {
    ...draft,
    data: { ...draft.data, publishedAt: draft.data.publishedAt ?? new Date() },
  };
  const document = buildDocument({
    ...collections,
    [collection]: SINGLE.has(collection) ? [dated] : withDraft(collections[collection], dated),
  });
  return JSON.parse(JSON.stringify(document), (key, value) =>
    key === "src" && typeof value === "string" ? `/preview${value}` : value,
  );
}
