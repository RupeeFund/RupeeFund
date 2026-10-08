import type { Content } from "./schema.ts";

const MEDIA_PREFIX = "/media/";

export function mediaKeys(content: Content): string[] {
  const keys = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === "object" && value !== null) {
      const { src } = value as { src?: unknown };
      if (typeof src === "string" && src.startsWith(MEDIA_PREFIX)) {
        keys.add(src.slice(MEDIA_PREFIX.length));
      }
      Object.values(value).forEach(walk);
    }
  };
  walk(content);
  return [...keys];
}
