import { ASSETS } from "../.generated/assets.ts";

export const IMMUTABLE = "private, max-age=31536000, immutable";

export function asset(path: string): Response | undefined {
  const found = ASSETS[path];
  if (found === undefined) return undefined;
  const bytes = Uint8Array.from(atob(found.base64), (char) => char.charCodeAt(0));
  return new Response(bytes, {
    headers: { "content-type": found.type, "cache-control": IMMUTABLE },
  });
}
