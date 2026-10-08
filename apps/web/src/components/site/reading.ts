import type { Post } from "../../content/schema.ts";

const WORDS_PER_MINUTE = 200;

export function readingMinutes(body: Post["body"]): number {
  const words = body
    .flatMap((block) => (block._type === "block" ? block.children.map((span) => span.text) : []))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
