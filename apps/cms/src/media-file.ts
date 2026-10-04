import { MEDIA_FILE } from "@rupeefund/content/schema";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

export function mediaFile(key: string, body: BodyInit, cacheControl: string): Response | null {
  if (!MEDIA_FILE.test(key)) return null;
  const extension = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return new Response(body, {
    headers: {
      "content-type": TYPES[extension]!,
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": cacheControl,
    },
  });
}
